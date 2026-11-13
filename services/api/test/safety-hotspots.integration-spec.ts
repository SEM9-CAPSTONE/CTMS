import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { ROUTE_DEVIATION_ANALYSIS_VERSION } from "../src/modules/route-deviation-analysis/route-deviation-analysis.constants";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BASE_LNG = 108.24;
const BASE_LAT = 16.06;
/** Point `metres` north of the base point (1 m ≈ 1/111 320 degree of latitude). */
const north = (meters: number) => BASE_LAT + meters / 111_320;

describe("Detect potential safety hotspots (CTMS-116, real Postgres/PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
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
		await assertSafeTestDatabase(dataSource);
		admin = await createAccount(UserRole.ADMIN);
		host = await createAccount(UserRole.HOST);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query('DELETE FROM "potential_safety_hotspots" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query(
				'DELETE FROM "hotspot_detection_runs" WHERE "triggered_by" = ANY($1)',
				[userIds]
			);
			await dataSource.query(
				'DELETE FROM "route_deviation_trip_analyses" WHERE "trip_id" = ANY($1)',
				[tripIds]
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
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Hotspot user')`,
			[id, `hotspot-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Hotspot route',
			   ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, $3), ST_MakePoint(108.26, $3)), 4326)::geography,
			   4300, 'moderate', 240, 'active')`,
			[id, host.id, BASE_LAT]
		);
		routeIds.push(id);
		return id;
	}

	/** A completed Trip on the Route with its CTMS-115 analysis row. */
	async function createTrip(
		routeId: string,
		routeVersion: string
	): Promise<{ tripId: string; analysisId: string }> {
		const tripId = randomUUID();
		const startsAt = new Date(Date.now() - 5 * DAY);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Hotspot trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
			   ST_GeogFromText('SRID=4326;POINT(108.22 16.06)'), $4::timestamptz - interval '2 hours', 1, 20, 1, 500000, 'completed')`,
			[tripId, host.id, routeId, startsAt]
		);
		tripIds.push(tripId);
		const [{ id }] = (await dataSource.query(
			`INSERT INTO "route_deviation_trip_analyses" ("trip_id", "analysis_version", "route_id", "route_version", "runtime_context", "analyzed_at")
			 VALUES ($1, $2, $3, $4, '{}'::jsonb, now()) RETURNING "id"`,
			[tripId, ROUTE_DEVIATION_ANALYSIS_VERSION, routeId, routeVersion]
		)) as Array<{ id: string }>;
		return { tripId, analysisId: id };
	}

	/** One RouteDeviationEvent starting `metresNorth` from the base point, `daysAgo` days ago. */
	async function addEvent(input: {
		trip: { tripId: string; analysisId: string };
		routeId: string;
		routeVersion: string;
		userId: string;
		metresNorth: number;
		daysAgo: number;
		authoritative?: boolean;
	}): Promise<string> {
		const authoritative = input.authoritative ?? true;
		const startedAt = new Date(Date.now() - input.daysAgo * DAY);
		const [{ id }] = (await dataSource.query(
			`INSERT INTO "route_deviation_events" ("analysis_id", "analysis_version", "config_version", "trip_id", "route_id",
			   "route_version", "package_version", "user_id", "participant_role", "started_at", "confirmed_at", "ended_at",
			   "end_reason", "sample_count", "valid_sample_count", "max_distance_meters", "avg_distance_meters",
			   "start_location", "max_distance_location", "start_route_fraction", "start_gps_log_id", "end_gps_log_id",
			   "runtime_context", "authoritative", "context_issues")
			 VALUES ($1, $2, 'v3', $3, $4, $5, $6, $7, 'camper', $8, $8::timestamptz + interval '1 minute',
			   $8::timestamptz + interval '5 minutes', 'RECOVERED', 4, 3, 80, 70,
			   ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
			   0.5, $11, $12, '{}'::jsonb, $13, $14::text[]) RETURNING "id"`,
			[
				input.trip.analysisId,
				ROUTE_DEVIATION_ANALYSIS_VERSION,
				input.trip.tripId,
				input.routeId,
				input.routeVersion,
				authoritative ? "5" : null,
				input.userId,
				startedAt,
				BASE_LNG,
				north(input.metresNorth),
				randomUUID(),
				randomUUID(),
				authoritative,
				authoritative ? [] : ["PACKAGE_VERSION_MISSING"],
			]
		)) as Array<{ id: string }>;
		return id;
	}

	const api = () => request(app.getHttpServer());
	const asAdmin = (call: request.Test) => call.set("Authorization", `Bearer ${admin.accessToken}`);
	const detect = () => asAdmin(api().post("/api/admin/safety-hotspots/detect")).expect(200);
	const hotspotsOn = (routeId: string) =>
		dataSource.query(
			`SELECT "id", "status", "event_count" AS "eventCount", "distinct_trip_count" AS "trips",
			        "distinct_member_count" AS "members", "evidence_event_ids" AS "evidence",
			        "previous_hotspot_id" AS "previousHotspotId", "route_version" AS "routeVersion",
			        "window_start" AS "windowStart", "window_end" AS "windowEnd", "radius_meters" AS "radius",
			        "analysis_version" AS "analysisVersion", "config_version" AS "configVersion", "criteria"
			 FROM "potential_safety_hotspots" WHERE "route_id" = $1 ORDER BY "detected_at"`,
			[routeId]
		) as Promise<Array<Record<string, unknown>>>;

	it("detects one DETECTED candidate from a qualifying same-Route cluster, idempotently and without touching the Route", async () => {
		const routeId = await createRoute();
		const version = "route-md5-a";
		const [c1, c2, c3, c4] = [
			await createAccount(UserRole.CAMPER),
			await createAccount(UserRole.CAMPER),
			await createAccount(UserRole.CAMPER),
			await createAccount(UserRole.CAMPER),
		];
		const [t1, t2, t3] = [
			await createTrip(routeId, version),
			await createTrip(routeId, version),
			await createTrip(routeId, version),
		];
		const base = { routeId, routeVersion: version };
		// Qualifying cluster: 5 events within ~20 m, 3 Trips, 3 Members (repeats count once).
		const evidence = [
			await addEvent({ ...base, trip: t1, userId: c1.id, metresNorth: 60, daysAgo: 3 }),
			await addEvent({ ...base, trip: t2, userId: c2.id, metresNorth: 70, daysAgo: 3 }),
			await addEvent({ ...base, trip: t3, userId: c3.id, metresNorth: 65, daysAgo: 2 }),
			await addEvent({ ...base, trip: t1, userId: c1.id, metresNorth: 75, daysAgo: 2 }),
			await addEvent({ ...base, trip: t2, userId: c2.id, metresNorth: 80, daysAgo: 1 }),
		];
		// Excluded: non-authoritative, older than 30 days, and 200 m away.
		await addEvent({
			...base,
			trip: t3,
			userId: c4.id,
			metresNorth: 70,
			daysAgo: 1,
			authoritative: false,
		});
		await addEvent({ ...base, trip: t3, userId: c4.id, metresNorth: 70, daysAgo: 31 });
		const far = await addEvent({ ...base, trip: t3, userId: c4.id, metresNorth: 300, daysAgo: 1 });

		const [routeBefore] = (await dataSource.query(
			`SELECT md5(ST_AsBinary("route_geom")) AS "geom", "updated_at" AS "updatedAt" FROM "trekking_routes" WHERE "id" = $1`,
			[routeId]
		)) as Array<Record<string, unknown>>;
		const counts = async () =>
			(await dataSource.query(
				`SELECT (SELECT count(*)::int FROM "checkpoints") AS "checkpoints", (SELECT count(*)::int FROM "external_safety_features") AS "features"`
			)) as Array<Record<string, number>>;
		const countsBefore = await counts();

		const run = await detect();
		expect(run.body).toMatchObject({ candidatesCreated: expect.any(Number) });
		const [hotspot, ...others] = await hotspotsOn(routeId);
		expect(others).toEqual([]);
		expect(hotspot).toMatchObject({
			status: "DETECTED",
			eventCount: 5,
			trips: 3,
			members: 3,
			routeVersion: version,
			radius: 50,
			previousHotspotId: null,
			configVersion: "v3",
			analysisVersion: "v1-anchor-cluster",
		});
		expect([...(hotspot.evidence as string[])].sort()).toEqual([...evidence].sort());
		expect(hotspot.evidence).not.toContain(far);
		expect(hotspot.criteria).toMatchObject({
			windowDays: 30,
			clusterRadiusMeters: 50,
			minDistinctTrips: 3,
			minDistinctMembers: 3,
			minEvents: 5,
		});
		const windowMs =
			new Date(hotspot.windowEnd as string).getTime() -
			new Date(hotspot.windowStart as string).getTime();
		expect(windowMs).toBe(30 * DAY);
		expect(run.body.createdHotspotIds).toContain(hotspot.id);

		// AC8 / BR-356: nothing authoritative changed.
		const [routeAfter] = (await dataSource.query(
			`SELECT md5(ST_AsBinary("route_geom")) AS "geom", "updated_at" AS "updatedAt" FROM "trekking_routes" WHERE "id" = $1`,
			[routeId]
		)) as Array<Record<string, unknown>>;
		expect(routeAfter).toEqual(routeBefore);
		expect(await counts()).toEqual(countsBefore);

		// BR-361: the API exposes aggregates and evidence ids, never member ids.
		const detail = await asAdmin(api().get(`/api/admin/safety-hotspots/${hotspot.id}`)).expect(200);
		expect(JSON.stringify(detail.body)).not.toContain(c1.id);
		expect(detail.body).toMatchObject({
			eventCount: 5,
			distinctTripCount: 3,
			distinctMemberCount: 3,
			centerLat: expect.any(Number),
		});
		const listed = await asAdmin(
			api().get(`/api/admin/safety-hotspots?routeId=${routeId}&status=DETECTED`)
		).expect(200);
		expect(listed.body.map((h: { id: string }) => h.id)).toEqual([hotspot.id]);

		// Re-running finds the same place already covered: no duplicate.
		const again = await detect();
		expect(again.body.skipped.ALREADY_COVERED).toBeGreaterThanOrEqual(1);
		expect(await hotspotsOn(routeId)).toHaveLength(1);

		// BR-422: after a dismissal, a new candidate needs evidence that started later.
		await dataSource.query(
			`UPDATE "potential_safety_hotspots" SET "status" = 'DISMISSED', "status_changed_at" = $2 WHERE "id" = $1`,
			[hotspot.id, new Date(Date.now() - HOUR)]
		);
		const dismissed = await detect();
		expect(dismissed.body.skipped.DISMISSED_WITHOUT_NEW_EVIDENCE).toBeGreaterThanOrEqual(1);
		expect(await hotspotsOn(routeId)).toHaveLength(1);

		await addEvent({ ...base, trip: t3, userId: c3.id, metresNorth: 68, daysAgo: 0 });
		await detect();
		const after = await hotspotsOn(routeId);
		expect(after).toHaveLength(2);
		expect(after[1]).toMatchObject({
			status: "DETECTED",
			previousHotspotId: hotspot.id,
			eventCount: 6,
		});
		expect(after[0]).toMatchObject({ status: "DISMISSED" });
	});

	it("does not fabricate a candidate from insufficient evidence or across Route versions", async () => {
		const routeId = await createRoute();
		const campers = [
			await createAccount(UserRole.CAMPER),
			await createAccount(UserRole.CAMPER),
			await createAccount(UserRole.CAMPER),
		];
		const vA = [await createTrip(routeId, "version-a"), await createTrip(routeId, "version-a")];
		const vB = [await createTrip(routeId, "version-b")];
		// Same place: 3 events of version A (2 Trips) and 2 of version B (1 Trip) = 5 events, 3 Trips overall.
		await addEvent({
			routeId,
			routeVersion: "version-a",
			trip: vA[0],
			userId: campers[0].id,
			metresNorth: 60,
			daysAgo: 1,
		});
		await addEvent({
			routeId,
			routeVersion: "version-a",
			trip: vA[1],
			userId: campers[1].id,
			metresNorth: 62,
			daysAgo: 1,
		});
		await addEvent({
			routeId,
			routeVersion: "version-a",
			trip: vA[1],
			userId: campers[1].id,
			metresNorth: 64,
			daysAgo: 1,
		});
		await addEvent({
			routeId,
			routeVersion: "version-b",
			trip: vB[0],
			userId: campers[2].id,
			metresNorth: 61,
			daysAgo: 1,
		});
		await addEvent({
			routeId,
			routeVersion: "version-b",
			trip: vB[0],
			userId: campers[2].id,
			metresNorth: 63,
			daysAgo: 1,
		});

		await detect();
		expect(await hotspotsOn(routeId)).toEqual([]);
	});

	it("rejects bad ids, bad filters and non-Admins", async () => {
		await asAdmin(api().get(`/api/admin/safety-hotspots/${randomUUID()}`)).expect(404);
		await asAdmin(api().get("/api/admin/safety-hotspots/not-a-uuid")).expect(422);
		const badStatus = await asAdmin(api().get("/api/admin/safety-hotspots?status=CONFIRMED_BY_AI"));
		expect([400, 422]).toContain(badStatus.status);
		await api()
			.post("/api/admin/safety-hotspots/detect")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(403);
		await api().get("/api/admin/safety-hotspots").expect(401);
	});
});
