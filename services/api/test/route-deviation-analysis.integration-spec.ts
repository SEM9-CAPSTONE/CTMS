import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { ROUTE_DEVIATION_ANALYSIS_VERSION } from "../src/modules/route-deviation-analysis/route-deviation-analysis.constants";
import { RouteDeviationAnalysisRepository } from "../src/modules/route-deviation-analysis/route-deviation-analysis.repository";
import { RouteDeviationAnalysisService } from "../src/modules/route-deviation-analysis/route-deviation-analysis.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR = 60 * 60 * 1000;
/** The Route runs east–west along this latitude; 1 m north ≈ 1/111 320 degree. */
const ROUTE_LAT = 16.04;
const north = (meters: number) => ROUTE_LAT + meters / 111_320;

describe("Route Deviation Events from historical GPS (CTMS-115, real Postgres/PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let service: RouteDeviationAnalysisService;
	let repository: RouteDeviationAnalysisRepository;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let admin: Account;
	let host: Account;

	beforeAll(async () => {
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
		service = moduleRef.get(RouteDeviationAnalysisService);
		repository = moduleRef.get(RouteDeviationAnalysisRepository);
		await assertSafeTestDatabase(dataSource);
		admin = await createAccount(UserRole.ADMIN);
		host = await createAccount(UserRole.HOST);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				'DELETE FROM "route_deviation_trip_analyses" WHERE "trip_id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "safety_events" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "gps_logs" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
			const bookings = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
			await dataSource.query(`DELETE FROM "booking_members" WHERE "booking_id" IN (${bookings})`, [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)',
				[tripIds, userIds]
			);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Route deviation user')`,
			[id, `route-deviation-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(
		status: "completed" | "ongoing",
		startsAt: Date
	): Promise<{ tripId: string; routeId: string }> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Route deviation route',
			   ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, $3), ST_MakePoint(108.26, $3)), 4326)::geography,
			   4300, 'moderate', 240, 'active')`,
			[routeId, host.id, ROUTE_LAT]
		);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Route deviation trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
			   ST_GeogFromText('SRID=4326;POINT(108.22 16.04)'), $4::timestamptz - interval '2 hours', 1, 20, 1, 500000, $5)`,
			[tripId, host.id, routeId, startsAt, status]
		);
		tripIds.push(tripId);
		return { tripId, routeId };
	}

	async function joinAsCamper(tripId: string, camperId: string, checkedInAt: Date): Promise<void> {
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "status", "payment_status",
			   "trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount")
			 VALUES ($1, $2, $3, 1, 'confirmed', 'not_required', now(), now() + interval '8 hours', 0, 0)`,
			[bookingId, tripId, camperId]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at", "status_updated_by")
			 VALUES ($1, $2, $3, true, 'joined', $4, $5)`,
			[randomUUID(), bookingId, camperId, checkedInAt, host.id]
		);
	}

	/** One GPS log per 30 s; `[metres north of the Route, accuracy]`. */
	async function logTrack(
		tripId: string,
		userId: string,
		role: "camper" | "porter",
		from: Date,
		points: Array<[number, number]>,
		packageVersion: string | null = null
	): Promise<string[]> {
		const ids: string[] = [];
		for (const [index, [meters, accuracy]] of points.entries()) {
			const id = randomUUID();
			ids.push(id);
			await dataSource.query(
				`INSERT INTO "gps_logs" ("id", "trip_id", "user_id", "participant_role", "event_time", "location",
				   "accuracy_meters", "package_version", "config_version")
				 VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9, 'v3')`,
				[
					id,
					tripId,
					userId,
					role,
					new Date(from.getTime() + index * 30_000),
					108.23 + index * 0.0003,
					north(meters),
					accuracy,
					packageVersion,
				]
			);
		}
		return ids;
	}

	const api = () => request(app.getHttpServer());
	const asAdmin = (call: request.Test) => call.set("Authorization", `Bearer ${admin.accessToken}`);
	const eventsOf = (tripId: string) =>
		dataSource.query(
			`SELECT "id", "user_id" AS "userId", "participant_role" AS "participantRole", "end_reason" AS "endReason",
			        "sample_count" AS "sampleCount", "valid_sample_count" AS "validSampleCount",
			        "max_distance_meters" AS "maxDistance", "start_gps_log_id" AS "startLogId",
			        "device_safety_event_ids" AS "deviceEvents", "authoritative", "context_issues" AS "contextIssues",
			        "package_version" AS "packageVersion", "route_version" AS "routeVersion", "runtime_context" AS "runtimeContext"
			 FROM "route_deviation_events" WHERE "trip_id" = $1 ORDER BY "participant_role", "started_at"`,
			[tripId]
		) as Promise<Array<Record<string, unknown>>>;

	it("groups a completed Trip's GPS history into episodes with Trip, member, Route and package context", async () => {
		const startsAt = new Date(Date.now() - 30 * HOUR);
		const { tripId, routeId } = await createTrip("completed", startsAt);
		const camper = await createAccount(UserRole.CAMPER);
		const porter = await createAccount(UserRole.PORTER);
		const checkedIn = new Date(startsAt.getTime() + HOUR);
		await joinAsCamper(tripId, camper.id, checkedIn);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, 'assigned')`,
			[tripId, porter.id]
		);

		// Before check-in: outside the participation window, never used (BR-362).
		await logTrack(tripId, camper.id, "camper", new Date(startsAt.getTime() + 10 * 60_000), [
			[200, 5],
			[200, 5],
			[200, 5],
		]);
		// Camper: on route, 3 valid samples 100–120 m off (OFF_ROUTE), an invalid 30 m-accuracy sample
		// still inside the episode, then 3 samples back on route.
		const camperLogs = await logTrack(
			tripId,
			camper.id,
			"camper",
			new Date(checkedIn.getTime() + 60_000),
			[
				[0, 5],
				[0, 5],
				[100, 5],
				[110, 5],
				[120, 5],
				[100, 30],
				[2, 5],
				[2, 5],
				[2, 5],
			]
		);
		// The device's own OFF_ROUTE report, linked as cross-check evidence.
		const deviceEventId = randomUUID();
		await dataSource.query(
			`INSERT INTO "safety_events" ("id", "trip_id", "user_id", "participant_role", "event_type", "event_time", "location",
			   "accuracy_meters", "distance_to_route_meters", "consecutive_valid_samples", "detected_offline", "route_id", "route_version", "config_version")
			 VALUES ($1, $2, $3, 'camper', 'OFF_ROUTE', $4, ST_SetSRID(ST_MakePoint(108.231, $5), 4326)::geography, 5, 100, 3, false, $6, 'device-md5', 'v3')`,
			[
				deviceEventId,
				tripId,
				camper.id,
				new Date(checkedIn.getTime() + 4 * 60_000),
				north(100),
				routeId,
			]
		);
		// Porter: off route until the evidence ends, logs carry package version 5.
		await logTrack(
			tripId,
			porter.id,
			"porter",
			new Date(checkedIn.getTime() + 60_000),
			[
				[0, 5],
				[90, 5],
				[95, 5],
				[100, 5],
				[100, 5],
			],
			"5"
		);

		const run = await asAdmin(
			api().post(`/api/admin/route-deviation-analysis/trips/${tripId}/run`)
		).expect(200);
		expect(run.body).toMatchObject({
			tripId,
			analysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
			routeId,
			participants: 2,
			samplesTotal: 17,
			samplesUsed: 14,
			samplesExcluded: { OUTSIDE_PARTICIPATION: 3 },
			episodes: 2,
			triggeredBy: admin.id,
		});
		expect(run.body.runtimeContext).toMatchObject({
			samplingIntervalSeconds: 10,
			loggingIntervalSeconds: 30,
			validSampleMaxAccuracyMeters: 20,
			offRouteMinDistanceMeters: 50,
			onRouteMaxDistanceMeters: 20,
			consecutiveSamples: 3,
		});

		const [camperEpisode, porterEpisode] = await eventsOf(tripId);
		expect(camperEpisode).toMatchObject({
			userId: camper.id,
			participantRole: "camper",
			endReason: "RECOVERED",
			sampleCount: 4,
			validSampleCount: 3,
			startLogId: camperLogs[2],
			deviceEvents: [deviceEventId],
			authoritative: false,
			contextIssues: ["PACKAGE_VERSION_MISSING"],
			packageVersion: null,
		});
		expect(camperEpisode.maxDistance).toBeGreaterThan(115);
		expect(camperEpisode.routeVersion).toMatch(/^[0-9a-f]{32}$/);
		expect(porterEpisode).toMatchObject({
			userId: porter.id,
			participantRole: "porter",
			endReason: "EVIDENCE_ENDED",
			sampleCount: 4,
			authoritative: true,
			contextIssues: [],
			packageVersion: "5",
		});

		// Raw evidence is untouched.
		const [{ logs }] = (await dataSource.query(
			`SELECT count(*)::int AS "logs" FROM "gps_logs" WHERE "trip_id" = $1`,
			[tripId]
		)) as Array<{ logs: number }>;
		expect(logs).toBe(17);

		// Re-running replaces the episodes: same result, no duplicates.
		await asAdmin(api().post(`/api/admin/route-deviation-analysis/trips/${tripId}/run`)).expect(
			200
		);
		const again = await eventsOf(tripId);
		expect(again).toHaveLength(2);
		expect(again.map((event) => event.startLogId)).toEqual([
			camperEpisode.startLogId,
			porterEpisode.startLogId,
		]);
		expect(
			await repository.findTripsToAnalyze(ROUTE_DEVIATION_ANALYSIS_VERSION, 10_000)
		).not.toContain(tripId);

		const detail = await asAdmin(
			api().get(`/api/admin/route-deviation-analysis/trips/${tripId}`)
		).expect(200);
		expect(detail.body.events).toHaveLength(2);
		const authoritative = await asAdmin(
			api().get(`/api/admin/route-deviation-events?tripId=${tripId}&authoritative=true`)
		).expect(200);
		expect(authoritative.body.map((event: { userId: string }) => event.userId)).toEqual([
			porter.id,
		]);
		expect(authoritative.body[0]).toEqual(
			expect.objectContaining({ startLat: expect.any(Number), startLng: expect.any(Number) })
		);
	});

	it("only analyses completed Trips (AC1) and lets the worker pick up the ones not analysed yet", async () => {
		const ongoing = await createTrip("ongoing", new Date(Date.now() - HOUR));
		await asAdmin(
			api().post(`/api/admin/route-deviation-analysis/trips/${ongoing.tripId}/run`)
		).expect(409);
		await expect(service.analyzeTrip(ongoing.tripId, null, { skipLocked: true })).resolves.toEqual({
			status: "skipped",
			reason: "NOT_COMPLETED",
		});
		expect(
			await repository.findTripsToAnalyze(ROUTE_DEVIATION_ANALYSIS_VERSION, 10_000)
		).not.toContain(ongoing.tripId);

		const quiet = await createTrip("completed", new Date(Date.now() - 50 * HOUR));
		expect(await repository.findTripsToAnalyze(ROUTE_DEVIATION_ANALYSIS_VERSION, 10_000)).toContain(
			quiet.tripId
		);
		await expect(
			service.analyzeTrip(quiet.tripId, null, { skipLocked: true })
		).resolves.toMatchObject({
			status: "analyzed",
			episodes: 0,
		});
		expect(
			await repository.findTripsToAnalyze(ROUTE_DEVIATION_ANALYSIS_VERSION, 10_000)
		).not.toContain(quiet.tripId);
	});

	it("rejects unknown Trips, bad ids, bad filters and non-Admins", async () => {
		await asAdmin(
			api().post(`/api/admin/route-deviation-analysis/trips/${randomUUID()}/run`)
		).expect(404);
		await asAdmin(api().post("/api/admin/route-deviation-analysis/trips/not-a-uuid/run")).expect(
			422
		);
		await asAdmin(api().get(`/api/admin/route-deviation-analysis/trips/${randomUUID()}`)).expect(
			404
		);
		const badLimit = await asAdmin(api().get("/api/admin/route-deviation-events?limit=0"));
		expect([400, 422]).toContain(badLimit.status);
		await api()
			.get("/api/admin/route-deviation-events")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(403);
		await api().get("/api/admin/route-deviation-events").expect(401);
	});
});
