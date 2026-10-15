import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface TestActor {
	id: string;
	token: string;
}

const FAR_FUTURE_START = new Date("2035-07-10T08:00:00.000Z");
const FAR_FUTURE_END = new Date("2035-07-10T16:00:00.000Z");

describe("POST /api/trips/:tripId/porter-requests (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds = new Set<string>();
	const routeIds = new Set<string>();
	const tripIds = new Set<string>();

	beforeAll(async () => {
		jest.setTimeout(60000);
		process.env.PORTER_REQUEST_TTL_HOURS = "72";
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
	}, 60000);

	afterEach(async () => {
		const users = [...userIds];
		const routes = [...routeIds];
		const trips = [...tripIds];
		await dataSource.query(
			`DELETE FROM "porter_requests"
			 WHERE "trip_id" = ANY($1::uuid[])
			    OR "porter_id" = ANY($2::uuid[])
			    OR "requested_by" = ANY($2::uuid[])`,
			[trips, users]
		);
		await dataSource.query(
			`DELETE FROM "trip_porters"
			 WHERE "trip_id" = ANY($1::uuid[]) OR "porter_id" = ANY($2::uuid[])`,
			[trips, users]
		);
		await dataSource.query(`DELETE FROM "trips" WHERE "id" = ANY($1::uuid[])`, [trips]);
		await dataSource.query(
			`DELETE FROM "porter_route_qualifications"
			 WHERE "route_id" = ANY($1::uuid[]) OR "porter_id" = ANY($2::uuid[])`,
			[routes, users]
		);
		await dataSource.query(`DELETE FROM "porter_profiles" WHERE "porter_id" = ANY($1::uuid[])`, [
			users,
		]);
		await dataSource.query(`DELETE FROM "trekking_routes" WHERE "id" = ANY($1::uuid[])`, [routes]);
		await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1::uuid[])`, [users]);
		await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1::uuid[])`, [users]);
		userIds.clear();
		routeIds.clear();
		tripIds.clear();
	});

	afterAll(async () => {
		await app.close();
	});

	async function createActor(role: UserRole, name: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, `ctms045-${id}@example.com`, "unused", role, UserStatus.ACTIVE, name]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createPorter(
		name: string,
		options: { status?: UserStatus; availability?: "available" | "unavailable" } = {}
	): Promise<string> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`ctms045-${id}@example.com`,
				"unused",
				UserRole.PORTER,
				options.status ?? UserStatus.ACTIVE,
				name,
			]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			UserRole.PORTER,
		]);
		await dataSource.query(
			`INSERT INTO "porter_profiles" ("porter_id", "experience_years", "availability_status")
			 VALUES ($1, $2, $3)`,
			[id, 4, options.availability ?? "available"]
		);
		return id;
	}

	async function createRoute(hostId: string): Promise<string> {
		const routeId = randomUUID();
		routeIds.add(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id",
				"host_id",
				"name",
				"route_geom",
				"length_meters",
				"difficulty",
				"expected_duration_minutes",
				"status"
			)
			VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8)`,
			[
				routeId,
				hostId,
				`CTMS-045 Route-${routeId}`,
				"SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)",
				2500,
				"moderate",
				180,
				"active",
			]
		);
		return routeId;
	}

	async function createTrip(
		hostId: string,
		routeId: string,
		startsAt = FAR_FUTURE_START,
		endsAt = FAR_FUTURE_END,
		status = "draft"
	): Promise<string> {
		const tripId = randomUUID();
		tripIds.add(tripId);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id",
				"host_id",
				"route_id",
				"title",
				"trip_type",
				"duration_nights",
				"starts_at",
				"ends_at",
				"meeting_point",
				"booking_deadline",
				"capacity_min",
				"capacity_max",
				"price_per_person",
				"status"
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_GeogFromText($9), $10, $11, $12, $13, $14)`,
			[
				tripId,
				hostId,
				routeId,
				`CTMS-045 Trip-${tripId}`,
				"day_trip",
				0,
				startsAt,
				endsAt,
				"SRID=4326;POINT(108.45 11.94)",
				new Date(startsAt.getTime() - 24 * 60 * 60 * 1000),
				1,
				20,
				100000,
				status,
			]
		);
		return tripId;
	}

	async function qualifyLead(porterId: string, routeId: string, verifierId: string): Promise<void> {
		await dataSource.query(
			`INSERT INTO "porter_route_qualifications" (
				"porter_id",
				"route_id",
				"proficiency",
				"times_led",
				"verified_by",
				"verified_at"
			)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			[porterId, routeId, "proficient", 2, verifierId, new Date("2034-01-01T00:00:00.000Z")]
		);
	}

	function createRequest(token: string, tripId: string, body: Record<string, unknown>) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/porter-requests`)
			.set("Authorization", `Bearer ${token}`)
			.send(body);
	}

	function respond(token: string, requestId: string, action: "accept" | "decline") {
		return request(app.getHttpServer())
			.patch(`/api/trips/porter-requests/${requestId}/${action}`)
			.set("Authorization", `Bearer ${token}`)
			.send({});
	}

	it("creates a pending Porter Request with Trip, Porter, requester, role, note, and no pay fields", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);
		const porterId = await createPorter("Eligible Porter");
		await qualifyLead(porterId, routeId, host.id);

		const response = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "lead",
			note: "Please lead the ridge section",
		}).expect(201);

		expect(response.body).toMatchObject({
			tripId,
			porterId,
			requestedBy: host.id,
			requestedRole: "lead",
			note: "Please lead the ridge section",
			status: "pending",
			respondedAt: null,
		});
		expect(response.body.dayRate).toBeUndefined();
		expect(response.body.pay).toBeUndefined();

		const rows = await dataSource.query(
			`SELECT
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt"
			 FROM "porter_requests"
			 WHERE "id" = $1`,
			[response.body.id]
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			tripId,
			porterId,
			requestedBy: host.id,
			requestedRole: "lead",
			note: "Please lead the ridge section",
			status: "pending",
		});
		expect(new Date(rows[0].expiresAt).getTime()).toBeLessThanOrEqual(FAR_FUTURE_START.getTime());
	});

	it("returns the existing pending request on duplicate retry and keeps a single pending row", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);
		const porterId = await createPorter("Eligible Porter");

		const first = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
			note: "First note",
		}).expect(201);

		const retry = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
			note: "Different retry note",
		}).expect(201);

		expect(retry.body.id).toBe(first.body.id);
		expect(retry.body.note).toBe("First note");

		const rows = await dataSource.query(
			`SELECT COUNT(*)::int AS "count"
			 FROM "porter_requests"
			 WHERE "trip_id" = $1 AND "porter_id" = $2 AND "status" = 'pending'`,
			[tripId, porterId]
		);
		expect(rows[0].count).toBe(1);
	});

	it("caps request expiry at Trip start when the configured TTL would exceed it", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
		const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);
		const tripId = await createTrip(host.id, routeId, startsAt, endsAt);
		const porterId = await createPorter("Soon Trip Porter");

		const response = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
		}).expect(201);

		expect(new Date(response.body.expiresAt).toISOString()).toBe(startsAt.toISOString());
	});

	it("rejects foreign Hosts, ineligible Porters, and unsupported compensation payload", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const foreignHost = await createActor(UserRole.HOST, "Foreign Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);
		const porterId = await createPorter("Eligible Porter");
		const unavailablePorterId = await createPorter("Unavailable Porter", {
			availability: "unavailable",
		});
		const conflictedPorterId = await createPorter("Conflicted Porter");
		const conflictTripId = await createTrip(host.id, routeId);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3)`,
			[conflictTripId, conflictedPorterId, TripPorterStatus.ASSIGNED]
		);

		await createRequest(foreignHost.token, tripId, {
			porterId,
			requestedRole: "support",
		}).expect(403);

		await createRequest(host.token, tripId, {
			porterId: unavailablePorterId,
			requestedRole: "support",
		}).expect(409);

		await createRequest(host.token, tripId, {
			porterId: conflictedPorterId,
			requestedRole: "support",
		}).expect(409);

		await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
			dayRate: 100000,
		}).expect(422);

		const rows = await dataSource.query(
			`SELECT COUNT(*)::int AS "count" FROM "porter_requests" WHERE "trip_id" = $1`,
			[tripId]
		);
		expect(rows[0].count).toBe(0);
	});

	it("accepts a pending request by creating exactly one assigned Trip Porter atomically", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(
			host.id,
			routeId,
			FAR_FUTURE_START,
			FAR_FUTURE_END,
			"published"
		);
		const porterId = await createPorter("Eligible Porter");
		const porterToken = jwtService.sign({ sub: porterId, roles: [UserRole.PORTER] });

		const created = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
		}).expect(201);

		const accepted = await respond(porterToken, created.body.id, "accept").expect(200);
		expect(accepted.body).toMatchObject({
			id: created.body.id,
			status: "accepted",
			assignment: { tripId, porterId, status: "assigned" },
		});

		const retry = await respond(porterToken, created.body.id, "accept").expect(200);
		expect(retry.body).toMatchObject({
			id: created.body.id,
			status: "accepted",
			assignment: { tripId, porterId, status: "assigned" },
		});

		const rows = await dataSource.query(
			`SELECT COUNT(*)::int AS "count"
			 FROM "trip_porters"
			 WHERE "trip_id" = $1 AND "porter_id" = $2 AND "status" = $3`,
			[tripId, porterId, TripPorterStatus.ASSIGNED]
		);
		expect(rows[0].count).toBe(1);
	});

	it("declines a pending request without creating an Assignment", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(
			host.id,
			routeId,
			FAR_FUTURE_START,
			FAR_FUTURE_END,
			"published"
		);
		const porterId = await createPorter("Eligible Porter");
		const porterToken = jwtService.sign({ sub: porterId, roles: [UserRole.PORTER] });

		const created = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
		}).expect(201);

		const declined = await respond(porterToken, created.body.id, "decline").expect(200);
		expect(declined.body).toMatchObject({ id: created.body.id, status: "declined" });

		const rows = await dataSource.query(
			`SELECT COUNT(*)::int AS "count" FROM "trip_porters" WHERE "trip_id" = $1`,
			[tripId]
		);
		expect(rows[0].count).toBe(0);
	});

	it("rejects another Porter and stale availability at accept time", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(
			host.id,
			routeId,
			FAR_FUTURE_START,
			FAR_FUTURE_END,
			"published"
		);
		const porterId = await createPorter("Target Porter");
		const otherPorterId = await createPorter("Other Porter");
		const porterToken = jwtService.sign({ sub: porterId, roles: [UserRole.PORTER] });
		const otherPorterToken = jwtService.sign({ sub: otherPorterId, roles: [UserRole.PORTER] });

		const created = await createRequest(host.token, tripId, {
			porterId,
			requestedRole: "support",
		}).expect(201);

		await respond(otherPorterToken, created.body.id, "accept").expect(403);
		await dataSource.query(
			`UPDATE "porter_profiles" SET "availability_status" = 'unavailable' WHERE "porter_id" = $1`,
			[porterId]
		);
		await respond(porterToken, created.body.id, "accept").expect(409);

		const rows = await dataSource.query(`SELECT "status" FROM "porter_requests" WHERE "id" = $1`, [
			created.body.id,
		]);
		expect(rows[0].status).toBe("pending");
	});
});
