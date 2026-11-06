import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { GUIDANCE } from "../src/modules/schedule-progress/schedule-progress.constants";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface MemberStatus {
	userId: string;
	status: string;
	reference: { checkpointId: string; checkpointName: string } | null;
	lagMinutes: number | null;
	safeCheckpoint: { id: string; name: string } | null;
	guidance: string | null;
}

/**
 * Route runs due north along longitude 108.2 from latitude 16.00 to 16.10 (~11 km).
 * 0.001° latitude ≈ 111 m, so 0.0001° ≈ 11 m.
 */
const LNG = 108.2;
const point = (lat: number, lng = LNG) => `SRID=4326;POINT(${lng} ${lat})`;

describe("Behind-schedule progress (CTMS-063 / Jira CTMS-319, integration, real Postgres + PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const tripIds: string[] = [];
	const routeIds: string[] = [];

	let host: Account;
	let porter: Account;
	let otherHost: Account;

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
		host = await createAccount(UserRole.HOST, "host");
		porter = await createAccount(UserRole.PORTER, "porter");
		otherHost = await createAccount(UserRole.HOST, "other-host");
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "safety_events" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "gps_logs" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "checkpoint_visits" WHERE "trip_id" = ANY($1)', [
					tripIds,
				]);
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query(
					'DELETE FROM "booking_members" WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
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
				`sched-ctms319-${label}-${id}@example.com`,
				await hash("P@ssword123", 4),
				role,
				UserStatus.ACTIVE,
				`Sched ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	interface Fixture {
		tripId: string;
		checkpoints: Record<string, string>;
		addCamper(label: string): Promise<{ account: Account; memberId: string }>;
		porterConfirms(checkpoint: string, minutesAgo: number, memberIds: string[]): Promise<void>;
		gps(
			camper: Account,
			lat: number,
			secondsAgo: number,
			accuracy?: number,
			lng?: number
		): Promise<void>;
	}

	/** One ongoing Trip per test, with checkpoints along the Route (types chosen per test). */
	async function createTrip(
		checkpointTypes: Array<[string, string, number]> = [
			["start", "start", 16.0],
			["ridge", "dangerous", 16.03],
			["rest", "rest", 16.05],
			["finish", "finish", 16.1],
		]
	): Promise<Fixture> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty",
			   "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Sched route', ST_GeogFromText($3), 11000, 'moderate', 300, 'active')`,
			[routeId, host.id, `SRID=4326;LINESTRING(${LNG} 16.0, ${LNG} 16.1)`]
		);
		const checkpoints: Record<string, string> = {};
		for (const [key, type, lat] of checkpointTypes) {
			const id = randomUUID();
			checkpoints[key] = id;
			await dataSource.query(
				`INSERT INTO "checkpoints" ("id", "route_id", "name", "location", "radius_m", "type",
				   "expected_arrival_offset", "instructions", "nearby_water_or_shelter", "route_position")
				 VALUES ($1, $2, $3, ST_GeogFromText($4), 30, $5, 0, '', false, $6)`,
				[id, routeId, `CP ${key}`, point(lat), type, Math.round((lat - 16.0) * 1000) / 100]
			);
		}
		const tripId = randomUUID();
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Sched trip', 'day_trip', 0, now() - interval '4 hours', now() + interval '4 hours',
			   ST_GeogFromText($4), now() - interval '1 day', 1, 20, 2, 0, 'ongoing')`,
			[tripId, host.id, routeId, point(16.0)]
		);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, 'assigned')`,
			[tripId, porter.id]
		);

		return {
			tripId,
			checkpoints,
			async addCamper(label) {
				const account = await createAccount(UserRole.CAMPER, label);
				const bookingId = randomUUID();
				const memberId = randomUUID();
				await dataSource.query(
					`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status")
					 VALUES ($1, $2, $3, 1, 0, 'confirmed')`,
					[bookingId, tripId, account.id]
				);
				await dataSource.query(
					`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
					 VALUES ($1, $2, $3, true, 'joined', now() - interval '4 hours')`,
					[memberId, bookingId, account.id]
				);
				return { account, memberId };
			},
			// Like CTMS-056 today: one Porter confirmation writes a row for every listed member.
			async porterConfirms(checkpoint, minutesAgo, memberIds) {
				for (const memberId of memberIds) {
					await dataSource.query(
						`INSERT INTO "checkpoint_visits" ("id", "trip_id", "checkpoint_id", "member_id", "confirmed_by_id",
						   "arrived_at", "captured_offline")
						 VALUES ($1, $2, $3, $4, $5, now() - make_interval(mins => $6::int), false)`,
						[randomUUID(), tripId, checkpoints[checkpoint], memberId, porter.id, minutesAgo]
					);
				}
			},
			async gps(camper, lat, secondsAgo, accuracy = 8, lng = LNG) {
				await dataSource.query(
					`INSERT INTO "gps_logs" ("id", "trip_id", "user_id", "participant_role", "event_time", "location",
					   "accuracy_meters", "config_version", "received_at")
					 VALUES ($1, $2, $3, 'camper', now() - make_interval(secs => $4::int), ST_GeogFromText($5), $6, 'v3', now())`,
					[randomUUID(), tripId, camper.id, secondsAgo, point(lat, lng), accuracy]
				);
			},
		};
	}

	async function progress(tripId: string, viewer: Account): Promise<request.Response> {
		return request(app.getHttpServer())
			.get(`/api/trips/${tripId}/schedule-progress`)
			.set("Authorization", `Bearer ${viewer.accessToken}`);
	}

	async function statusOf(tripId: string, camper: Account): Promise<MemberStatus> {
		const res = await progress(tripId, host);
		expect(res.status).toBe(200);
		return (res.body.members as MemberStatus[]).find((m) => m.userId === camper.id) as MemberStatus;
	}

	async function warningRows(tripId: string, userId: string) {
		return (await dataSource.query(
			`SELECT "warning_level"::text AS "level", "checkpoint_id" AS "checkpointId", "participant_role"::text AS "role"
			 FROM "safety_events" WHERE "trip_id" = $1 AND "user_id" = $2 AND "event_type"::text = 'BEHIND_SCHEDULE'
			 ORDER BY "warning_level"`,
			[tripId, userId]
		)) as Array<{ level: string; checkpointId: string; role: string }>;
	}

	it("ON_TRACK when the Camper's own VALID sample is within 20 m of the Porter-confirmed Checkpoint", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("near");
		await trip.porterConfirms("ridge", 90, [memberId]);
		await trip.gps(account, 16.0301, 60);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("ON_TRACK");
		expect(status.reference).toBeNull();
	});

	it("ON_TRACK when the Camper passed the Checkpoint before the Porter (along-route evidence)", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("ahead");
		await trip.gps(account, 16.04, 7200);
		await trip.gps(account, 16.045, 30);
		await trip.porterConfirms("ridge", 90, [memberId]);

		expect((await statusOf(trip.tripId, account)).status).toBe("ON_TRACK");
	});

	it("29 minutes behind stays ON_TRACK; 30 minutes is BEHIND with the safe Checkpoint ahead and policy text", async () => {
		const trip = await createTrip();
		const early = await trip.addCamper("29");
		const late = await trip.addCamper("30");
		await trip.porterConfirms("ridge", 29, [early.memberId]);
		await trip.gps(early.account, 16.02, 30);

		const onTrack = await statusOf(trip.tripId, early.account);
		expect(onTrack.status).toBe("ON_TRACK");
		expect(onTrack.lagMinutes).toBe(29);
		expect(await warningRows(trip.tripId, early.account.id)).toEqual([]);

		await dataSource.query(
			`UPDATE "checkpoint_visits" SET "arrived_at" = now() - interval '30 minutes 5 seconds' WHERE "trip_id" = $1`,
			[trip.tripId]
		);
		await trip.gps(late.account, 16.02, 30);
		const behind = await statusOf(trip.tripId, late.account);

		expect(behind.status).toBe("BEHIND");
		expect(behind.lagMinutes).toBe(30);
		expect(behind.safeCheckpoint?.name).toBe("CP rest");
		expect(behind.guidance).toBe(GUIDANCE.behind(30, "CP ridge", "CP rest"));
	});

	it("SEVERELY_BEHIND at 60 minutes uses the nearest safe Checkpoint in either direction", async () => {
		const trip = await createTrip([
			["start", "start", 16.0],
			["water", "water", 16.015],
			["ridge", "dangerous", 16.03],
			["finish", "finish", 16.1],
		]);
		const { account, memberId } = await trip.addCamper("severe");
		await trip.porterConfirms("ridge", 61, [memberId]);
		await trip.gps(account, 16.016, 20);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("SEVERELY_BEHIND");
		expect(status.safeCheckpoint?.name).toBe("CP water");
		expect(status.guidance).toBe(GUIDANCE.severelyBehind("CP water"));
	});

	it("LOCATION_UNKNOWN, never behind, when the last VALID sample is older than 5 minutes", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("stale");
		await trip.porterConfirms("ridge", 70, [memberId]);
		await trip.gps(account, 16.02, 6 * 60);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("LOCATION_UNKNOWN");
		expect(status.guidance).toBe(GUIDANCE.locationUnknown);
		expect(await warningRows(trip.tripId, account.id)).toEqual([]);
	});

	it("an INVALID sample (accuracy > 20 m) at the Checkpoint is not evidence of passing", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("invalid");
		await trip.porterConfirms("ridge", 40, [memberId]);
		await trip.gps(account, 16.03, 30, 35);
		await trip.gps(account, 16.02, 40, 8);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("BEHIND");
		expect(status.reference?.checkpointName).toBe("CP ridge");
	});

	it("Porter-written checkpoint_visits rows for the Camper are not evidence the Camper passed", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("visits-only");
		await trip.porterConfirms("ridge", 45, [memberId]);
		await trip.gps(account, 16.01, 30);

		expect((await statusOf(trip.tripId, account)).status).toBe("BEHIND");
	});

	it("no Porter confirmation yet means nothing to evaluate", async () => {
		const trip = await createTrip();
		const { account } = await trip.addCamper("no-baseline");
		await trip.gps(account, 16.0, 30);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("ON_TRACK");
		expect(status.reference).toBeNull();
	});

	it("no safe Checkpoint on the Route gives the fallback text and no fabricated Checkpoint", async () => {
		const trip = await createTrip([
			["start", "start", 16.0],
			["ridge", "dangerous", 16.03],
			["cliff", "dangerous", 16.06],
		]);
		const { account, memberId } = await trip.addCamper("no-safe");
		await trip.porterConfirms("ridge", 65, [memberId]);
		await trip.gps(account, 16.02, 30);

		const status = await statusOf(trip.tripId, account);

		expect(status.status).toBe("SEVERELY_BEHIND");
		expect(status.safeCheckpoint).toBeNull();
		expect(status.guidance).toBe(GUIDANCE.noSafeCheckpoint);
	});

	it("records each level once, even when evaluated repeatedly and concurrently", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("idempotent");
		await trip.porterConfirms("ridge", 65, [memberId]);
		await trip.gps(account, 16.02, 30);

		await Promise.all(Array.from({ length: 5 }, () => progress(trip.tripId, host)));
		await progress(trip.tripId, porter);

		const rows = await warningRows(trip.tripId, account.id);
		expect(rows).toEqual([
			{ level: "BEHIND", checkpointId: trip.checkpoints.ridge, role: "camper" },
			{ level: "SEVERELY_BEHIND", checkpointId: trip.checkpoints.ridge, role: "camper" },
		]);
	});

	it("clears the warning once the Camper passes X and moves on to the next Porter-confirmed Checkpoint", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("recovers");
		await trip.porterConfirms("ridge", 50, [memberId]);
		await trip.gps(account, 16.02, 60);
		expect((await statusOf(trip.tripId, account)).status).toBe("BEHIND");

		await trip.porterConfirms("rest", 10, [memberId]);
		await trip.gps(account, 16.0302, 5);

		const status = await statusOf(trip.tripId, account);
		expect(status.status).toBe("ON_TRACK");
		expect(status.reference?.checkpointName).toBe("CP rest");
		expect(status.lagMinutes).toBe(10);
		expect(await warningRows(trip.tripId, account.id)).toHaveLength(1);
	});

	it("does not count server warnings as device-synchronized safety events (CTMS-067)", async () => {
		const trip = await createTrip();
		const { account, memberId } = await trip.addCamper("device-sync");
		await trip.porterConfirms("ridge", 65, [memberId]);
		await trip.gps(account, 16.02, 30);
		await progress(trip.tripId, host);
		expect(await warningRows(trip.tripId, account.id)).toHaveLength(2);

		const counts = (await dataSource.query(
			`SELECT COUNT(*)::int AS "n" FROM "safety_events"
			 WHERE "trip_id" = $1 AND "user_id" = $2 AND "event_type"::text <> 'BEHIND_SCHEDULE'`,
			[trip.tripId, account.id]
		)) as Array<{ n: number }>;
		expect(counts[0].n).toBe(0);
	});

	describe("authorization (§13.5)", () => {
		it("a Camper sees only their own status; Host and assigned Porter see everyone", async () => {
			const trip = await createTrip();
			const a = await trip.addCamper("auth-a");
			const b = await trip.addCamper("auth-b");

			const asCamper = await progress(trip.tripId, a.account);
			const asPorter = await progress(trip.tripId, porter);
			const asHost = await progress(trip.tripId, host);

			expect(asCamper.status).toBe(200);
			expect(asCamper.body.viewer).toBe("camper");
			expect(asCamper.body.members.map((m: MemberStatus) => m.userId)).toEqual([a.account.id]);
			expect(asPorter.body.viewer).toBe("team");
			expect(asHost.body.members.map((m: MemberStatus) => m.userId).sort()).toEqual(
				[a.account.id, b.account.id].sort()
			);
		});

		it("refuses a Host of another Trip and an unrelated Camper; 404 unknown Trip; 401 anonymous", async () => {
			const trip = await createTrip();
			const stranger = await createAccount(UserRole.CAMPER, "stranger");

			expect((await progress(trip.tripId, otherHost)).status).toBe(403);
			expect((await progress(trip.tripId, stranger)).status).toBe(403);
			expect((await progress(randomUUID(), host)).status).toBe(404);
			expect(
				(await request(app.getHttpServer()).get(`/api/trips/${trip.tripId}/schedule-progress`))
					.status
			).toBe(401);
		});

		it("does not evaluate a Trip that is not ongoing", async () => {
			const trip = await createTrip();
			const { account, memberId } = await trip.addCamper("completed");
			await trip.porterConfirms("ridge", 65, [memberId]);
			await trip.gps(account, 16.02, 30);
			await dataSource.query(`UPDATE "trips" SET "status" = 'completed' WHERE "id" = $1`, [
				trip.tripId,
			]);

			const res = await progress(trip.tripId, host);

			expect(res.body.members).toEqual([]);
			expect(await warningRows(trip.tripId, account.id)).toEqual([]);
		});
	});

	it("the database rejects a BEHIND_SCHEDULE row without checkpoint and level", async () => {
		const trip = await createTrip();
		const { account } = await trip.addCamper("db-check");

		await expect(
			dataSource.query(
				`INSERT INTO "safety_events" ("id", "trip_id", "user_id", "participant_role", "event_type", "event_time",
				   "detected_offline", "route_id", "route_version", "config_version", "received_at")
				 SELECT gen_random_uuid(), $1, $2, 'camper', 'BEHIND_SCHEDULE', now(), false, t."route_id", 'x', 'v3', now()
				 FROM "trips" t WHERE t."id" = $1`,
				[trip.tripId, account.id]
			)
		).rejects.toThrow(/CHK_safety_events_behind_schedule/);
	});
});
