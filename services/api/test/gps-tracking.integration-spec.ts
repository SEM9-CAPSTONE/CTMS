import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import {
	GpsLogIngestStatus,
	GpsLogRejectionReason,
	GpsTrackingIneligibleReason,
} from "../src/modules/gps-tracking/gps-tracking.enums";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;

describe("GPS breadcrumb tracking (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

	let host: Account;
	let joinedCamper: Account;
	let registeredCamper: Account;
	let otherJoinedCamper: Account;
	let assignedPorter: Account;
	let unassignedPorter: Account;
	let outsider: Account;
	let ongoingTripId: string;
	let completedTripId: string;
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
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "gps_logs" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
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
		await app?.close();
	});

	async function createAccount(role: UserRole, label: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`gps-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`GPS ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(routeId: string, status: TripStatus, startsAt: Date): Promise<string> {
		const tripId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'GPS Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 0, 0, $5
			 )`,
			[tripId, host.id, routeId, startsAt, status]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function addCamper(tripId: string, camperId: string, memberStatus: BookingMemberStatus) {
		const bookingId = randomUUID();
		const statusAt = new Date(tripStart.getTime() - HOUR_MS / 2);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount"
			 ) VALUES ($1, $2, $3, 1, $4, 'not_required', now(), now() + interval '8 hours', 0, 0)`,
			[bookingId, tripId, camperId, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at", "status_updated_by"
			 ) VALUES (
				$1, $2, $3, true, $4::booking_member_status,
				CASE WHEN $4::booking_member_status = 'joined' THEN $5::timestamptz ELSE NULL END,
				CASE WHEN $4::booking_member_status = 'joined' THEN $6::uuid ELSE NULL END
			 )`,
			[randomUUID(), bookingId, camperId, memberStatus, statusAt, host.id]
		);
		bookingIds.push(bookingId);
	}

	async function createFixture(): Promise<void> {
		host = await createAccount(UserRole.HOST, "host");
		joinedCamper = await createAccount(UserRole.CAMPER, "joined");
		registeredCamper = await createAccount(UserRole.CAMPER, "registered");
		otherJoinedCamper = await createAccount(UserRole.CAMPER, "other-joined");
		assignedPorter = await createAccount(UserRole.PORTER, "assigned-porter");
		unassignedPorter = await createAccount(UserRole.PORTER, "unassigned-porter");
		outsider = await createAccount(UserRole.CAMPER, "outsider");

		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'GPS route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			 )`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		tripStart = new Date(Date.now() - 2 * HOUR_MS);
		ongoingTripId = await createTrip(routeId, TripStatus.ONGOING, tripStart);
		completedTripId = await createTrip(routeId, TripStatus.COMPLETED, tripStart);
		publishedTripId = await createTrip(routeId, TripStatus.PUBLISHED, tripStart);

		for (const tripId of [ongoingTripId, completedTripId, publishedTripId]) {
			await addCamper(tripId, joinedCamper.id, BookingMemberStatus.JOINED);
		}
		await addCamper(ongoingTripId, registeredCamper.id, BookingMemberStatus.REGISTERED);
		await addCamper(ongoingTripId, otherJoinedCamper.id, BookingMemberStatus.JOINED);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3), ($1, $4, $5)`,
			[
				ongoingTripId,
				assignedPorter.id,
				TripPorterStatus.ASSIGNED,
				unassignedPorter.id,
				TripPorterStatus.UNASSIGNED,
			]
		);
	}

	function gpsLog(overrides: Record<string, unknown> = {}) {
		return {
			id: randomUUID(),
			eventTime: new Date(tripStart.getTime() + HOUR_MS).toISOString(),
			latitude: 16.054321,
			longitude: 108.234567,
			accuracyMeters: 7.5,
			altitudeMeters: 1210.4,
			batteryLevel: 63,
			packageVersion: "pkg-2026.10.1",
			configVersion: "v3",
			...overrides,
		};
	}

	function getContext(account: Account, tripId: string) {
		return request(app.getHttpServer())
			.get(`/api/trips/${tripId}/gps-tracking/context`)
			.set("Authorization", `Bearer ${account.accessToken}`);
	}

	function postLogs(account: Account, tripId: string, logs: unknown[]) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/gps-logs`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send({ logs });
	}

	async function countLogs(id: string): Promise<number> {
		const rows = (await dataSource.query(
			'SELECT count(*)::int AS "count" FROM "gps_logs" WHERE "id" = $1',
			[id]
		)) as Array<{ count: number }>;
		return rows[0].count;
	}

	describe("GET /trips/:tripId/gps-tracking/context (BR-237 / BR-368 / BR-396)", () => {
		it("lets a joined Camper track an ongoing Trip with the fixed 10s/30s V3 intervals", async () => {
			const response = await getContext(joinedCamper, ongoingTripId).expect(200);

			expect(response.body).toEqual({
				tripId: ongoingTripId,
				eligible: true,
				reason: null,
				participantRole: "camper",
				samplingIntervalSeconds: 10,
				loggingIntervalSeconds: 30,
				configVersion: "v3",
			});
		});

		it("lets an assigned Porter track an ongoing Trip", async () => {
			const response = await getContext(assignedPorter, ongoingTripId).expect(200);

			expect(response.body).toMatchObject({ eligible: true, participantRole: "porter" });
		});

		it.each([
			[
				"a Camper who has not joined",
				() => registeredCamper,
				GpsTrackingIneligibleReason.CAMPER_NOT_JOINED,
			],
			[
				"an unassigned Porter",
				() => unassignedPorter,
				GpsTrackingIneligibleReason.PORTER_NOT_ASSIGNED,
			],
		])("refuses tracking for %s", async (_label, account, reason) => {
			const response = await getContext(account(), ongoingTripId).expect(200);

			expect(response.body).toMatchObject({ eligible: false, reason });
		});

		it.each([
			["published", () => publishedTripId],
			["completed", () => completedTripId],
		])("refuses tracking while the Trip is %s", async (_label, tripId) => {
			const response = await getContext(joinedCamper, tripId()).expect(200);

			expect(response.body).toMatchObject({
				eligible: false,
				reason: GpsTrackingIneligibleReason.TRIP_NOT_ONGOING,
			});
		});

		it("forbids a user who is not part of the Trip", async () => {
			await getContext(outsider, ongoingTripId).expect(403);
		});

		it("forbids roles other than Camper and Porter", async () => {
			await getContext(host, ongoingTripId).expect(403);
		});

		it("returns 404 for an unknown Trip", async () => {
			await getContext(joinedCamper, randomUUID()).expect(404);
		});
	});

	describe("POST /trips/:tripId/gps-logs (BR-237 / BR-244 / BR-396 / BR-188)", () => {
		it("persists a log with its original time, coordinates and context, owned by user + Trip", async () => {
			const log = gpsLog();

			const response = await postLogs(joinedCamper, ongoingTripId, [log]).expect(200);

			expect(response.body.results).toEqual([
				{ id: log.id, status: GpsLogIngestStatus.ACCEPTED, reason: null },
			]);
			const [row] = (await dataSource.query(
				`SELECT "trip_id" AS "tripId", "user_id" AS "userId", "participant_role" AS "role",
				        "event_time" AS "eventTime", ST_Y("location"::geometry) AS "latitude",
				        ST_X("location"::geometry) AS "longitude", "accuracy_meters" AS "accuracy",
				        "altitude_meters" AS "altitude", "battery_level" AS "battery",
				        "package_version" AS "packageVersion", "config_version" AS "configVersion",
				        "received_at" AS "receivedAt"
				 FROM "gps_logs" WHERE "id" = $1`,
				[log.id]
			)) as Array<Record<string, unknown>>;
			expect(row).toMatchObject({
				tripId: ongoingTripId,
				userId: joinedCamper.id,
				role: "camper",
				eventTime: new Date(log.eventTime),
				latitude: log.latitude,
				longitude: log.longitude,
				accuracy: log.accuracyMeters,
				altitude: log.altitudeMeters,
				battery: log.batteryLevel,
				packageVersion: log.packageVersion,
				configVersion: "v3",
			});
			expect(row.receivedAt).toBeInstanceOf(Date);
		});

		it("accepts a log from an assigned Porter", async () => {
			const log = gpsLog();

			const response = await postLogs(assignedPorter, ongoingTripId, [log]).expect(200);

			expect(response.body.results[0].status).toBe(GpsLogIngestStatus.ACCEPTED);
		});

		it("treats a retried upload of the same UUID as a duplicate without a second row", async () => {
			const log = gpsLog();
			await postLogs(joinedCamper, ongoingTripId, [log]).expect(200);

			const retry = await postLogs(joinedCamper, ongoingTripId, [log]).expect(200);

			expect(retry.body.results[0]).toEqual({
				id: log.id,
				status: GpsLogIngestStatus.DUPLICATE,
				reason: null,
			});
			expect(await countLogs(log.id)).toBe(1);
		});

		it("stores exactly one row when the same UUID is uploaded concurrently", async () => {
			const log = gpsLog();

			const responses = await Promise.all(
				Array.from({ length: 5 }, () => postLogs(joinedCamper, ongoingTripId, [log]))
			);

			const statuses = responses.map((response) => response.body.results[0].status).sort();
			expect(statuses).toEqual([
				GpsLogIngestStatus.ACCEPTED,
				GpsLogIngestStatus.DUPLICATE,
				GpsLogIngestStatus.DUPLICATE,
				GpsLogIngestStatus.DUPLICATE,
				GpsLogIngestStatus.DUPLICATE,
			]);
			expect(await countLogs(log.id)).toBe(1);
		});

		it("rejects another user's reuse of an existing UUID and keeps the original owner", async () => {
			const log = gpsLog();
			await postLogs(joinedCamper, ongoingTripId, [log]).expect(200);

			const response = await postLogs(otherJoinedCamper, ongoingTripId, [log]).expect(200);

			expect(response.body.results[0]).toEqual({
				id: log.id,
				status: GpsLogIngestStatus.REJECTED,
				reason: GpsLogRejectionReason.ID_CONFLICT,
			});
			const [owner] = (await dataSource.query(
				'SELECT "user_id" AS "userId" FROM "gps_logs" WHERE "id" = $1',
				[log.id]
			)) as Array<{ userId: string }>;
			expect(owner.userId).toBe(joinedCamper.id);
		});

		it("accepts late synchronization for a completed Trip", async () => {
			const response = await postLogs(joinedCamper, completedTripId, [gpsLog()]).expect(200);

			expect(response.body.results[0].status).toBe(GpsLogIngestStatus.ACCEPTED);
		});

		it.each([
			[
				"a Trip that never started",
				() => joinedCamper,
				() => publishedTripId,
				{},
				GpsLogRejectionReason.TRIP_NOT_TRACKABLE,
			],
			[
				"a Camper who has not joined",
				() => registeredCamper,
				() => ongoingTripId,
				{},
				GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE,
			],
			[
				"an unassigned Porter",
				() => unassignedPorter,
				() => ongoingTripId,
				{},
				GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE,
			],
			[
				"a sample captured before the Trip",
				() => joinedCamper,
				() => ongoingTripId,
				{ eventTime: "2020-01-01T00:00:00.000Z" },
				GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION,
			],
		])(
			"rejects and does not store a log from %s",
			async (_label, account, tripId, overrides, reason) => {
				const log = gpsLog(overrides);

				const response = await postLogs(account(), tripId(), [log]).expect(200);

				expect(response.body.results[0]).toEqual({
					id: log.id,
					status: GpsLogIngestStatus.REJECTED,
					reason,
				});
				expect(await countLogs(log.id)).toBe(0);
			}
		);

		it("returns a per-log outcome so one rejected log does not block the rest of the batch", async () => {
			const good = gpsLog();
			const outside = gpsLog({ eventTime: "2020-01-01T00:00:00.000Z" });

			const response = await postLogs(joinedCamper, ongoingTripId, [good, outside]).expect(200);

			expect(response.body.results.map((result: { status: string }) => result.status)).toEqual([
				GpsLogIngestStatus.ACCEPTED,
				GpsLogIngestStatus.REJECTED,
			]);
			expect(await countLogs(good.id)).toBe(1);
		});

		it.each([
			["a missing latitude (no fabricated coordinates)", { latitude: undefined }],
			["an eventTime without timezone", { eventTime: "2026-10-12T10:00:00" }],
		])("rejects a batch containing %s with 422 and stores nothing", async (_label, overrides) => {
			const log = gpsLog(overrides);

			await postLogs(joinedCamper, ongoingTripId, [log]).expect(422);

			expect(await countLogs(log.id)).toBe(0);
		});

		it("forbids a user who is not part of the Trip", async () => {
			await postLogs(outsider, ongoingTripId, [gpsLog()]).expect(403);
		});
	});
});
