import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { HotspotPackageImpactDispatcher } from "../src/modules/safety-hotspots/hotspot-package-impact.dispatcher";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const DAY = 24 * 60 * 60 * 1000;
const REASON = "Nhiều đoàn rẽ nhầm tại ngã ba suối, bổ sung hướng dẫn rẽ trái theo cọc tiêu đỏ.";

describe("Corrective actions from confirmed safety hotspots (CTMS-118, real Postgres/PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let admin: Account;
	let host: Account;
	let camper: Account;

	beforeAll(async () => {
		process.env.OFFLINE_PACKAGE_WORKER_ENABLED = "false";
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
		admin = await createAccount(UserRole.ADMIN, "Trần Minh Quân");
		host = await createAccount(UserRole.HOST, "Lê Thu Hà");
		camper = await createAccount(UserRole.CAMPER, "Phạm Gia Bảo");
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				'DELETE FROM "hotspot_corrective_actions" WHERE "route_id" = ANY($1)',
				[routeIds]
			);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "potential_safety_hotspots" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "offline_package_jobs" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, fullName: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, $5)`,
			[id, `correction-${role}-${id}@example.com`, role, UserStatus.ACTIVE, fullName]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	/** An ACTIVE Route with one checkpoint, a published Trip and an ongoing Trip. */
	async function createRouteWithTrips(status = "active") {
		const routeId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Khám phá bán đảo Sơn Trà',
			   ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.06), ST_MakePoint(108.26, 16.06)), 4326)::geography,
			   4300, 'moderate', 240, $3)`,
			[routeId, host.id, status]
		);
		routeIds.push(routeId);
		const [{ id: checkpointId }] = (await dataSource.query(
			`INSERT INTO "checkpoints" ("route_id", "name", "location", "radius_m", "type", "expected_arrival_offset",
			   "instructions", "nearby_water_or_shelter", "route_position")
			 VALUES ($1, 'Ngã ba suối Đá', ST_SetSRID(ST_MakePoint(108.24, 16.06), 4326)::geography, 30, 'rest', 90,
			   'Nghỉ chân, kiểm đếm thành viên', false, 0.5) RETURNING "id"`,
			[routeId]
		)) as Array<{ id: string }>;
		const publishedTripId = await createTrip(routeId, "published", Date.now() + 10 * DAY);
		const ongoingTripId = await createTrip(routeId, "ongoing", Date.now() - 60 * 60 * 1000);
		return { routeId, checkpointId, publishedTripId, ongoingTripId };
	}

	async function createTrip(routeId: string, status: string, startsAtMs: number): Promise<string> {
		const tripId = randomUUID();
		const startsAt = new Date(startsAtMs);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Sơn Trà bình minh', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
			   ST_GeogFromText('SRID=4326;POINT(108.22 16.06)'), $4::timestamptz - interval '2 hours', 1, 20, 1, 500000, $5)`,
			[tripId, host.id, routeId, startsAt, status]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function createHotspot(routeId: string, status: string): Promise<string> {
		const now = Date.now();
		const [{ id }] = (await dataSource.query(
			`INSERT INTO "potential_safety_hotspots"
			   ("route_id", "route_version", "status", "status_changed_at", "analysis_version", "config_version",
			    "criteria", "window_start", "window_end", "center", "radius_meters", "anchor_event_id",
			    "route_fraction_min", "route_fraction_max", "event_count", "distinct_trip_count",
			    "distinct_member_count", "evidence_event_ids", "evidence_hash", "first_event_at", "last_event_at",
			    "detected_at")
			 VALUES ($1, 'route-md5-a', $2, $3, 'v1-anchor-cluster', 'v3', '{}'::jsonb, $4, $3,
			   ST_SetSRID(ST_MakePoint(108.24, 16.06), 4326)::geography, 50, $5, 0.4, 0.6, 5, 3, 3,
			   $6::uuid[], $7, $8, $9, $3) RETURNING "id"`,
			[
				routeId,
				status,
				new Date(now),
				new Date(now - 30 * DAY),
				randomUUID(),
				[randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()],
				randomUUID().replace(/-/g, "").padEnd(64, "0"),
				new Date(now - 10 * DAY),
				new Date(now - 2 * DAY),
			]
		)) as Array<{ id: string }>;
		return id;
	}

	const api = () => request(app.getHttpServer());
	const as = (account: Account, call: request.Test) =>
		call.set("Authorization", `Bearer ${account.accessToken}`);
	const correct = (account: Account, hotspotId: string, body: Record<string, unknown>) =>
		as(account, api().post(`/api/admin/safety-hotspots/${hotspotId}/corrective-actions`)).send(
			body
		);
	const instructionsBody = (checkpointId: string) => ({
		actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
		reason: REASON,
		checkpointId,
		instructions: "Rẽ trái theo cọc tiêu đỏ, không đi theo lối mòn bên phải",
	});
	/** Impact jobs only; publishing a Trip already queues its "initial" package job. */
	const jobsFor = (tripId: string) =>
		dataSource.query(
			`SELECT "request_key" FROM "offline_package_jobs" WHERE "trip_id" = $1 AND "request_key" LIKE 'impact:%'`,
			[tripId]
		) as Promise<Array<{ request_key: string }>>;

	it("only Admins may apply a correction", async () => {
		const { routeId, checkpointId } = await createRouteWithTrips();
		const hotspotId = await createHotspot(routeId, "CONFIRMED");
		await correct(host, hotspotId, instructionsBody(checkpointId)).expect(403);
		await correct(camper, hotspotId, instructionsBody(checkpointId)).expect(403);
	});

	it.each(["DETECTED", "UNDER_REVIEW", "DISMISSED"])(
		"a %s hotspot cannot drive a correction and the checkpoint is unchanged",
		async (status) => {
			const { routeId, checkpointId } = await createRouteWithTrips();
			const hotspotId = await createHotspot(routeId, status);
			const response = await correct(admin, hotspotId, instructionsBody(checkpointId)).expect(409);
			expect(response.body.code).toBe("HOTSPOT_NOT_CONFIRMED");
			const [checkpoint] = await dataSource.query(
				`SELECT "instructions" FROM "checkpoints" WHERE "id" = $1`,
				[checkpointId]
			);
			expect(checkpoint.instructions).toBe("Nghỉ chân, kiểm đếm thành viên");
		}
	);

	it("rejects a checkpoint of another Route", async () => {
		const { routeId } = await createRouteWithTrips();
		const other = await createRouteWithTrips();
		const hotspotId = await createHotspot(routeId, "CONFIRMED");
		const response = await correct(admin, hotspotId, instructionsBody(other.checkpointId)).expect(
			404
		);
		expect(response.body.code).toBe("TARGET_NOT_ON_ROUTE");
	});

	it("rejects geometry changes as an unsupported action", async () => {
		const { routeId } = await createRouteWithTrips();
		const hotspotId = await createHotspot(routeId, "CONFIRMED");
		await correct(admin, hotspotId, { actionType: "UPDATE_ROUTE_GEOMETRY", reason: REASON }).expect(
			422
		);
	});

	it("updates instructions on an ACTIVE Route, audits it, links the evidence and requests a new package version only for the published Trip", async () => {
		const { routeId, checkpointId, publishedTripId, ongoingTripId } = await createRouteWithTrips();
		const hotspotId = await createHotspot(routeId, "CONFIRMED");

		const response = await correct(admin, hotspotId, instructionsBody(checkpointId)).expect(201);
		expect(response.body).toMatchObject({
			actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
			targetName: "Ngã ba suối Đá",
			packageImpact: "AFFECTED",
			impactTripCount: 1,
			actorName: "Trần Minh Quân",
		});
		expect(response.body.impactRequestedAt).not.toBeNull();

		const [checkpoint] = await dataSource.query(
			`SELECT "instructions", "name", ST_AsText("location"::geometry) AS "location" FROM "checkpoints" WHERE "id" = $1`,
			[checkpointId]
		);
		expect(checkpoint).toEqual({
			instructions: "Rẽ trái theo cọc tiêu đỏ, không đi theo lối mòn bên phải",
			name: "Ngã ba suối Đá",
			location: "POINT(108.24 16.06)",
		});

		const [action] = await dataSource.query(
			`SELECT action."hotspot_evidence_hash" = hotspot."evidence_hash" AS "evidenceLinked",
			        action."impact_trip_ids" AS "impactTripIds", action."before", action."after"
			 FROM "hotspot_corrective_actions" action
			 JOIN "potential_safety_hotspots" hotspot ON hotspot."id" = action."hotspot_id"
			 WHERE action."id" = $1`,
			[response.body.id]
		);
		expect(action.evidenceLinked).toBe(true);
		expect(action.impactTripIds).toEqual([publishedTripId]);
		expect(action.before.instructions).toBe("Nghỉ chân, kiểm đếm thành viên");

		const audits = await dataSource.query(
			`SELECT "before", "after", "reason" FROM "audit_logs"
			 WHERE "action" = 'safety_hotspot.corrective_action' AND "target_id" = $1`,
			[checkpointId]
		);
		expect(audits).toHaveLength(1);
		expect(audits[0].after.correctiveActionId).toBe(response.body.id);

		expect(await jobsFor(publishedTripId)).toHaveLength(1);
		expect(await jobsFor(ongoingTripId)).toHaveLength(0);

		// Re-requesting the same correction's impact is idempotent (no second job).
		await app.get(HotspotPackageImpactDispatcher).dispatch(response.body.id, [publishedTripId]);
		expect(await jobsFor(publishedTripId)).toHaveLength(1);

		const history = await as(
			admin,
			api().get(`/api/admin/safety-hotspots/${hotspotId}/corrective-actions`)
		).expect(200);
		expect(history.body).toHaveLength(1);
	});

	it("adds a hazard area without requesting a package version", async () => {
		const { routeId, publishedTripId } = await createRouteWithTrips();
		const hotspotId = await createHotspot(routeId, "CONFIRMED");
		const response = await correct(admin, hotspotId, {
			actionType: "ADD_HAZARD_AREA",
			reason: "Vách đá trơn sau mưa khiến nhiều đoàn đi vòng xuống lòng suối.",
			hazardArea: {
				geometry: { type: "Point", coordinates: [108.24, 16.06] },
				radiusMeters: 40,
				description: "Vách đá trơn trượt sau mưa",
				severity: "high",
			},
		}).expect(201);
		expect(response.body).toMatchObject({ packageImpact: "NOT_AFFECTED", impactTripCount: 0 });
		const zones = await dataSource.query(
			`SELECT "description" FROM "route_danger_zones" WHERE "route_id" = $1`,
			[routeId]
		);
		expect(zones).toEqual([{ description: "Vách đá trơn trượt sau mưa" }]);
		expect(await jobsFor(publishedTripId)).toHaveLength(0);

		const targets = await as(
			admin,
			api().get(`/api/admin/safety-hotspots/${hotspotId}/corrective-targets`)
		).expect(200);
		expect(targets.body.hazardAreas).toHaveLength(1);
		expect(targets.body.checkpoints[0].name).toBe("Ngã ba suối Đá");
	});

	it("rejects a correction on a closed Route", async () => {
		const { routeId, checkpointId } = await createRouteWithTrips("closed");
		const hotspotId = await createHotspot(routeId, "CONFIRMED");
		const response = await correct(admin, hotspotId, instructionsBody(checkpointId)).expect(409);
		expect(response.body.code).toBe("ROUTE_CLOSED");
	});
});
