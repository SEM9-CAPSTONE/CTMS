import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

type TestRole = "admin" | "host" | "camper" | "porter";
type TestStatus = "active" | "suspended";
type RouteStatus = "draft" | "pending_approval" | "active" | "closed";
type CheckpointType = "start" | "rest" | "water" | "dangerous" | "emergency_shelter" | "finish";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("CTMS-81 Host Route submission (integration, real PostgreSQL/PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let userIds: string[] = [];
	let campsiteIds: string[] = [];
	let routeIds: string[] = [];

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
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		await app?.close();
	});

	beforeEach(() => {
		userIds = [];
		campsiteIds = [];
		routeIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) return;
		await dataSource.query(
			'DROP TRIGGER IF EXISTS "test_reject_route_submission_audit" ON "audit_logs"'
		);
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_route_submission_audit"()');
		if (routeIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
		}
		if (campsiteIds.length > 0) {
			await dataSource.query('DELETE FROM "campsites" WHERE "id" = ANY($1)', [campsiteIds]);
		}
		if (userIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
	});

	async function createAccount(
		role: TestRole,
		status: TestStatus = "active"
	): Promise<TestAccount> {
		const marker = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, 'Route Submission Test User') RETURNING "id"`,
			[`route-submit-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role, status]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			'INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT DO NOTHING',
			[id, role]
		);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createCampsite(hostId: string): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "campsites"
			 ("host_id", "name", "description", "location", "province", "policies", "operating_hours", "status")
			 VALUES ($1, $2, 'submission fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'active') RETURNING "id"`,
			[hostId, `Submission Camp ${Date.now()}-${Math.random()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(campsiteId: string, status: RouteStatus = "draft"): Promise<string> {
		const rows = (await dataSource.query(
			`WITH geometry AS (
				SELECT ST_SetSRID(ST_MakeLine(ARRAY[
					ST_MakePoint(108.45, 11.94),
					ST_MakePoint(108.46, 11.945),
					ST_MakePoint(108.47, 11.95)
				]), 4326)::geography AS value
			)
			INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			SELECT $1, $2, 'submission fixture', value, ST_Length(value), 'moderate', 120, $3
			FROM geometry RETURNING "id"`,
			[campsiteId, `Submission Route ${Date.now()}-${Math.random()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createCheckpoint(
		routeId: string,
		type: CheckpointType,
		routePosition: number
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "checkpoints"
			 ("route_id", "name", "location", "radius_m", "type", "expected_arrival_offset",
			  "instructions", "nearby_water_or_shelter", "route_position")
			SELECT $1, $2,
			 ST_LineInterpolatePoint(route."route_geom"::geometry, $3)::geography,
			 25, $4, FLOOR($3 * route."expected_duration_minutes")::int,
			 'Follow the marked trail', true, $3
			FROM "trekking_routes" route WHERE route."id" = $1
			RETURNING "id"`,
			[routeId, `${type} checkpoint ${Math.random()}`, routePosition, type]
		)) as Array<{ id: string }>;
		return rows[0].id;
	}

	async function prepareRoute(routeId: string): Promise<void> {
		await createCheckpoint(routeId, "start", 0.1);
		await createCheckpoint(routeId, "finish", 0.9);
	}

	function submit(token: string | undefined, routeId: string, body?: object) {
		let pending = request(app.getHttpServer()).patch(
			`/api/trekking-routes/${routeId}/submit-for-approval`
		);
		if (body) pending = pending.send(body);
		return token ? pending.set("Authorization", `Bearer ${token}`) : pending;
	}

	function listPending(token: string) {
		return request(app.getHttpServer())
			.get("/api/trekking-routes/pending-review")
			.set("Authorization", `Bearer ${token}`);
	}

	async function storedStatus(routeId: string): Promise<RouteStatus> {
		const rows = (await dataSource.query('SELECT "status" FROM "trekking_routes" WHERE "id" = $1', [
			routeId,
		])) as Array<{ status: RouteStatus }>;
		return rows[0].status;
	}

	async function submissionAudits(routeId: string): Promise<Array<Record<string, unknown>>> {
		return dataSource.query(
			`SELECT "actor_id", "action", "target_type", "before", "after", "reason"
			 FROM "audit_logs" WHERE "target_id" = $1
			 AND "action" = 'trekking_route.submitted_for_approval'`,
			[routeId]
		) as Promise<Array<Record<string, unknown>>>;
	}

	it("submits a prepared owned draft, persists the audit, and appears in pending review", async () => {
		const host = await createAccount("host");
		const admin = await createAccount("admin");
		const routeId = await createRoute(await createCampsite(host.id));
		await prepareRoute(routeId);

		const response = await submit(host.accessToken, routeId, { status: "active" }).expect(200);

		expect(response.body).toEqual(
			expect.objectContaining({ id: routeId, status: "pending_approval" })
		);
		expect(await storedStatus(routeId)).toBe("pending_approval");
		expect(await submissionAudits(routeId)).toEqual([
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route.submitted_for_approval",
				target_type: "trekking_route",
				before: { status: "draft" },
				after: { status: "pending_approval" },
				reason: "host_submit_trekking_route_for_approval",
			}),
		]);
		const pending = await listPending(admin.accessToken).expect(200);
		expect(pending.body).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: routeId, status: "pending_approval" })])
		);
	});

	it.each([
		{ name: "no start", checkpoints: [["finish", 0.9]] },
		{
			name: "duplicate start",
			checkpoints: [
				["start", 0.1],
				["start", 0.2],
				["finish", 0.9],
			],
		},
		{ name: "no finish", checkpoints: [["start", 0.1]] },
		{
			name: "duplicate finish",
			checkpoints: [
				["start", 0.1],
				["finish", 0.8],
				["finish", 0.9],
			],
		},
		{
			name: "start after finish",
			checkpoints: [
				["start", 0.9],
				["finish", 0.1],
			],
		},
	] as Array<{ name: string; checkpoints: Array<[CheckpointType, number]> }>)(
		"returns 422 and stays draft for $name",
		async ({ checkpoints }) => {
			const host = await createAccount("host");
			const routeId = await createRoute(await createCampsite(host.id));
			for (const [type, position] of checkpoints) {
				await createCheckpoint(routeId, type, position);
			}

			await submit(host.accessToken, routeId).expect(422);
			expect(await storedStatus(routeId)).toBe("draft");
			expect(await submissionAudits(routeId)).toEqual([]);
		}
	);

	it("returns 422 for invalid authoritative Route or checkpoint data", async () => {
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const invalidRouteId = await createRoute(campsiteId);
		await prepareRoute(invalidRouteId);
		await dataSource.query('UPDATE "trekking_routes" SET "name" = $2 WHERE "id" = $1', [
			invalidRouteId,
			"",
		]);

		await submit(host.accessToken, invalidRouteId).expect(422);
		expect(await storedStatus(invalidRouteId)).toBe("draft");

		const invalidCheckpointRouteId = await createRoute(campsiteId);
		const checkpointId = await createCheckpoint(invalidCheckpointRouteId, "start", 0.1);
		await createCheckpoint(invalidCheckpointRouteId, "finish", 0.9);
		await dataSource.query('UPDATE "checkpoints" SET "instructions" = $2 WHERE "id" = $1', [
			checkpointId,
			"",
		]);

		await submit(host.accessToken, invalidCheckpointRouteId).expect(422);
		expect(await storedStatus(invalidCheckpointRouteId)).toBe("draft");
	});

	it("enforces authentication, active Host role, ownership, and missing Route semantics", async () => {
		const owner = await createAccount("host");
		const foreignHost = await createAccount("host");
		const inactiveHost = await createAccount("host", "suspended");
		const admin = await createAccount("admin");
		const camper = await createAccount("camper");
		const porter = await createAccount("porter");
		const routeId = await createRoute(await createCampsite(owner.id));
		await prepareRoute(routeId);

		await submit(undefined, routeId).expect(401);
		await submit(inactiveHost.accessToken, routeId).expect(401);
		await submit(admin.accessToken, routeId).expect(403);
		await submit(camper.accessToken, routeId).expect(403);
		await submit(porter.accessToken, routeId).expect(403);
		await submit(foreignHost.accessToken, routeId).expect(403);
		await submit(owner.accessToken, "00000000-0000-4000-8000-000000000099").expect(404);

		expect(await storedStatus(routeId)).toBe("draft");
		expect(await submissionAudits(routeId)).toEqual([]);
	});

	it.each(["pending_approval", "active", "closed"] as const)(
		"returns 409 from %s without mutation",
		async (status) => {
			const host = await createAccount("host");
			const routeId = await createRoute(await createCampsite(host.id), status);
			await prepareRoute(routeId);

			await submit(host.accessToken, routeId).expect(409);
			expect(await storedStatus(routeId)).toBe(status);
			expect(await submissionAudits(routeId)).toEqual([]);
		}
	);

	it("serializes concurrent submissions so the stale request returns 409", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await prepareRoute(routeId);

		const responses = await Promise.all([
			submit(host.accessToken, routeId),
			submit(host.accessToken, routeId),
		]);

		expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
		expect(await storedStatus(routeId)).toBe("pending_approval");
		expect(await submissionAudits(routeId)).toHaveLength(1);
	});

	it("rolls the status update back when audit insertion fails", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await prepareRoute(routeId);
		await dataSource.query(`CREATE FUNCTION "test_reject_route_submission_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action = 'trekking_route.submitted_for_approval' THEN
		     RAISE EXCEPTION 'forced route submission audit failure';
		   END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(
			`CREATE TRIGGER "test_reject_route_submission_audit" BEFORE INSERT ON "audit_logs"
			 FOR EACH ROW EXECUTE FUNCTION "test_reject_route_submission_audit"()`
		);

		await submit(host.accessToken, routeId).expect(500);
		expect(await storedStatus(routeId)).toBe("draft");
		expect(await submissionAudits(routeId)).toEqual([]);
	});
});
