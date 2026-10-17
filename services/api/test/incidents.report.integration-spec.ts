import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import {
	IncidentErrorCode,
	IncidentLocationStatus,
	IncidentReportOutcome,
} from "../src/modules/incidents/incidents.enums";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { getUploadRoot } from "../src/shared/uploads/upload-paths";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_DIGEST = createHash("sha256").update(JPEG_BYTES).digest("hex");

describe("Report incident during Trip (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const incidentIds: string[] = [];

	let host: Account;
	let otherHost: Account;
	let assignedPorter: Account;
	let unassignedPorter: Account;
	let otherAssignedPorter: Account;
	let ongoingTripId: string;
	let publishedTripId: string;
	let tripStart: Date;

	beforeAll(async () => {
		jest.setTimeout(60_000);
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
		await createFixture();
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (incidentIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
					incidentIds,
				]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trip_incidents" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await Promise.all(
			incidentIds.map((id) =>
				rm(join(getUploadRoot(), "incidents", `${id}-${JPEG_DIGEST}.jpg`), { force: true })
			)
		);
		await app?.close();
	});

	async function createAccount(role: UserRole, label: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`incident-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Incident ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(routeId: string, status: TripStatus): Promise<string> {
		const tripId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'Incident Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 0, 0, $5
			 )`,
			[tripId, host.id, routeId, tripStart, status]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function createFixture(): Promise<void> {
		host = await createAccount(UserRole.HOST, "host");
		otherHost = await createAccount(UserRole.HOST, "other-host");
		assignedPorter = await createAccount(UserRole.PORTER, "assigned");
		unassignedPorter = await createAccount(UserRole.PORTER, "unassigned");
		otherAssignedPorter = await createAccount(UserRole.PORTER, "other-assigned");

		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'Incident route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			 )`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		tripStart = new Date(Date.now() - 2 * HOUR_MS);
		ongoingTripId = await createTrip(routeId, TripStatus.ONGOING);
		publishedTripId = await createTrip(routeId, TripStatus.PUBLISHED);

		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status")
			 VALUES ($1, $2, $4), ($1, $3, $5), ($1, $6, $4), ($7, $2, $4)`,
			[
				ongoingTripId,
				assignedPorter.id,
				unassignedPorter.id,
				TripPorterStatus.ASSIGNED,
				TripPorterStatus.UNASSIGNED,
				otherAssignedPorter.id,
				publishedTripId,
			]
		);
	}

	function incident(overrides: Record<string, unknown> = {}) {
		const id = randomUUID();
		incidentIds.push(id);
		const occurredAt = new Date(tripStart.getTime() + HOUR_MS);
		return {
			id,
			category: "injury",
			severity: "high",
			description: "Camper twisted an ankle near the stream crossing",
			occurredAt: occurredAt.toISOString(),
			location: {
				latitude: 16.054321,
				longitude: 108.234567,
				accuracyMeters: 9.5,
				capturedAt: new Date(occurredAt.getTime() + 30_000).toISOString(),
			},
			capturedOffline: true,
			...overrides,
		};
	}

	function postIncident(account: Account, tripId: string, body: unknown) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/incidents`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send(body as object);
	}

	function listIncidents(account: Account, tripId: string) {
		return request(app.getHttpServer())
			.get(`/api/trips/${tripId}/incidents`)
			.set("Authorization", `Bearer ${account.accessToken}`);
	}

	async function countIncidents(id: string): Promise<number> {
		const rows = (await dataSource.query(
			'SELECT count(*)::int AS "count" FROM "trip_incidents" WHERE "id" = $1',
			[id]
		)) as Array<{ count: number }>;
		return rows[0].count;
	}

	describe("POST /trips/:tripId/incidents", () => {
		it("persists an assigned Porter's incident with original time, location and audit (BR-161)", async () => {
			const body = incident();
			const response = await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			expect(response.body.outcome).toBe(IncidentReportOutcome.CREATED);
			expect(response.body.incident).toMatchObject({
				id: body.id,
				tripId: ongoingTripId,
				reporterId: assignedPorter.id,
				reporterName: "Incident assigned",
				category: "injury",
				severity: "high",
				status: "open",
				occurredAt: body.occurredAt,
				locationStatus: IncidentLocationStatus.FRESH,
				capturedOffline: true,
				media: null,
			});
			expect(response.body.incident.location.latitude).toBeCloseTo(16.054321, 6);
			expect(response.body.incident.location.longitude).toBeCloseTo(108.234567, 6);

			const audits = (await dataSource.query(
				`SELECT "action", "actor_id" AS "actorId" FROM "audit_logs" WHERE "target_id" = $1`,
				[body.id]
			)) as Array<{ action: string; actorId: string }>;
			expect(audits).toEqual([{ action: "incident.report", actorId: assignedPorter.id }]);
		});

		it("keeps one authoritative incident when the same offline report is resent (BR-224 matrix)", async () => {
			const body = incident();
			await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			const [first, second] = await Promise.all([
				postIncident(assignedPorter, ongoingTripId, body),
				postIncident(assignedPorter, ongoingTripId, { ...body, description: "changed later" }),
			]);

			for (const response of [first, second]) {
				expect(response.status).toBe(200);
				expect(response.body.outcome).toBe(IncidentReportOutcome.DUPLICATE);
				expect(response.body.incident.description).toBe(body.description);
			}
			expect(await countIncidents(body.id)).toBe(1);
		});

		it("stores no coordinates when the location is unavailable", async () => {
			const body = incident({ location: null });
			const response = await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			expect(response.body.incident.location).toBeNull();
			expect(response.body.incident.locationStatus).toBe(IncidentLocationStatus.UNAVAILABLE);
		});

		it("flags a stale location fix (BR-221)", async () => {
			const body = incident();
			body.location.capturedAt = new Date(Date.parse(body.occurredAt) - HOUR_MS / 2).toISOString();
			const response = await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			expect(response.body.incident.locationStatus).toBe(IncidentLocationStatus.STALE);
		});

		it("rejects an unassigned Porter without creating anything", async () => {
			const body = incident();
			await postIncident(unassignedPorter, ongoingTripId, body).expect(403);
			expect(await countIncidents(body.id)).toBe(0);
		});

		it("rejects a Host using the Porter endpoint", async () => {
			await postIncident(host, ongoingTripId, incident()).expect(403);
		});

		it("rejects a Trip that has not started", async () => {
			const response = await postIncident(assignedPorter, publishedTripId, incident()).expect(409);
			expect(response.body.code).toBe(IncidentErrorCode.TRIP_NOT_IN_PROGRESS);
		});

		it("rejects an incident time before the Trip started", async () => {
			const response = await postIncident(
				assignedPorter,
				ongoingTripId,
				incident({
					occurredAt: new Date(tripStart.getTime() - HOUR_MS).toISOString(),
					location: null,
				})
			).expect(409);
			expect(response.body.code).toBe(IncidentErrorCode.OUTSIDE_TRIP_WINDOW);
		});

		it("rejects an id already used by another Porter's report", async () => {
			const body = incident();
			await postIncident(otherAssignedPorter, ongoingTripId, body).expect(200);

			const response = await postIncident(assignedPorter, ongoingTripId, body).expect(409);
			expect(response.body.code).toBe(IncidentErrorCode.ID_CONFLICT);
		});

		it("returns 422 for missing required fields and 404 for an unknown Trip", async () => {
			await postIncident(assignedPorter, ongoingTripId, incident({ description: "" })).expect(422);
			await postIncident(assignedPorter, ongoingTripId, incident({ category: undefined })).expect(
				422
			);
			await postIncident(assignedPorter, randomUUID(), incident()).expect(404);
		});
	});

	describe("GET /trips/:tripId/incidents", () => {
		it("shows the Trip's Host every incident and a Porter only their own", async () => {
			const own = incident();
			const others = incident();
			await postIncident(assignedPorter, ongoingTripId, own).expect(200);
			await postIncident(otherAssignedPorter, ongoingTripId, others).expect(200);

			const hostView = await listIncidents(host, ongoingTripId).expect(200);
			const hostIds = hostView.body.items.map((item: { id: string }) => item.id);
			expect(hostIds).toEqual(expect.arrayContaining([own.id, others.id]));

			const porterView = await listIncidents(assignedPorter, ongoingTripId).expect(200);
			const porterIds = porterView.body.items.map((item: { id: string }) => item.id);
			expect(porterIds).toContain(own.id);
			expect(porterIds).not.toContain(others.id);
		});

		it("rejects another Host and an unassigned Porter", async () => {
			await listIncidents(otherHost, ongoingTripId).expect(403);
			await listIncidents(unassignedPorter, ongoingTripId).expect(403);
		});
	});

	describe("PUT /trips/:tripId/incidents/:incidentId/media (BR-224)", () => {
		it("attaches a verified photo once and keeps it on retry", async () => {
			const body = incident();
			await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			const upload = () =>
				request(app.getHttpServer())
					.put(`/api/trips/${ongoingTripId}/incidents/${body.id}/media`)
					.set("Authorization", `Bearer ${assignedPorter.accessToken}`)
					.attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" });

			const first = await upload().expect(200);
			expect(first.body.media).toMatchObject({
				url: `/uploads/incidents/${body.id}-${JPEG_DIGEST}.jpg`,
				contentType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
			});
			const retry = await upload().expect(200);
			expect(retry.body.media.uploadedAt).toBe(first.body.media.uploadedAt);
		});

		it("rejects a disguised non-image file but keeps the incident", async () => {
			const body = incident();
			await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			const response = await request(app.getHttpServer())
				.put(`/api/trips/${ongoingTripId}/incidents/${body.id}/media`)
				.set("Authorization", `Bearer ${assignedPorter.accessToken}`)
				.attach("file", Buffer.from("not an image"), {
					filename: "photo.jpg",
					contentType: "image/jpeg",
				})
				.expect(422);

			expect(response.body.code).toBe(IncidentErrorCode.MEDIA_INVALID);
			expect(await countIncidents(body.id)).toBe(1);
		});

		it("rejects another Porter attaching media", async () => {
			const body = incident();
			await postIncident(assignedPorter, ongoingTripId, body).expect(200);

			await request(app.getHttpServer())
				.put(`/api/trips/${ongoingTripId}/incidents/${body.id}/media`)
				.set("Authorization", `Bearer ${otherAssignedPorter.accessToken}`)
				.attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" })
				.expect(403);
		});
	});
});
