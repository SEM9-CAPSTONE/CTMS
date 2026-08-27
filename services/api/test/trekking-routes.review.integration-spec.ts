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

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Trekking Route Admin review (integration, real PostgreSQL/PostGIS)", () => {
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
			'DROP TRIGGER IF EXISTS "test_reject_route_review_audit" ON "audit_logs"'
		);
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_route_review_audit"()');
		if (routeIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)',
				[routeIds, userIds]
			);
			await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
		}
		if (campsiteIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [campsiteIds]);
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
			 VALUES ($1, $2, $3, $4, 'Route Review Test User') RETURNING "id"`,
			[`route-review-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role, status]
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
			 VALUES ($1, $2, 'review fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'active') RETURNING "id"`,
			[hostId, `Review Camp ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(campsiteId: string, status: RouteStatus = "pending_approval") {
		const rows = (await dataSource.query(
			`WITH geometry AS (
				SELECT ST_SetSRID(ST_MakeLine(ARRAY[
					ST_MakePoint(108.458313, 11.940419),
					ST_MakePoint(108.4612, 11.9431),
					ST_MakePoint(108.4668, 11.9465)
				]), 4326)::geography AS value
			)
			INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			SELECT $1, $2, 'Admin review fixture', value, ST_Length(value), 'moderate', 120, $3
			FROM geometry RETURNING "id"`,
			[campsiteId, `Pending Ridge ${Date.now()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createCheckpoint(routeId: string, invalid = false): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "checkpoints"
			 ("route_id", "name", "location", "radius_m", "type", "expected_arrival_offset",
			  "instructions", "nearby_water_or_shelter", "route_position")
			 VALUES ($1, 'Trail start', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
			  25, 'start', $4, 'Meet the guide', true, 0)
			 RETURNING "id"`,
			[routeId, invalid ? 109.5 : 108.458313, invalid ? 12.5 : 11.940419, invalid ? 121 : 0]
		)) as Array<{ id: string }>;
		return rows[0].id;
	}

	function listPending(token?: string) {
		const req = request(app.getHttpServer()).get("/api/trekking-routes/pending-review");
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function reviewRoute(token: string | undefined, routeId: string, body: object) {
		const req = request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/review`)
			.send(body);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	async function storedStatus(routeId: string): Promise<RouteStatus> {
		const rows = (await dataSource.query('SELECT "status" FROM "trekking_routes" WHERE "id" = $1', [
			routeId,
		])) as Array<{ status: RouteStatus }>;
		return rows[0].status;
	}

	it("lets Admin discover only pending Routes with geometry, campsite, and ordered checkpoints", async () => {
		const admin = await createAccount("admin");
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const pendingId = await createRoute(campsiteId);
		await createCheckpoint(pendingId);
		await createRoute(campsiteId, "draft");

		const response = await listPending(admin.accessToken).expect(200);

		expect(response.body).toHaveLength(1);
		expect(response.body[0]).toEqual(
			expect.objectContaining({
				id: pendingId,
				campsiteId,
				campsiteName: expect.stringContaining("Review Camp"),
				geometry: expect.objectContaining({ type: "LineString" }),
				difficulty: "moderate",
				lengthMeters: expect.any(Number),
				expectedDurationMinutes: 120,
				status: "pending_approval",
				checkpoints: [expect.objectContaining({ name: "Trail start", type: "start" })],
			})
		);
	});

	it.each([
		{ action: "approve", target: "active", auditAction: "trekking_route.approved", reason: null },
		{
			action: "decline",
			target: "draft",
			auditAction: "trekking_route.declined",
			reason: "Needs safer instructions",
		},
		{
			action: "non_operable",
			target: "closed",
			auditAction: "trekking_route.closed",
			reason: "Operation prohibited",
		},
	] as const)("persists $action -> $target and its atomic audit", async (decision) => {
		const admin = await createAccount("admin");
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await createCheckpoint(routeId);
		const body = decision.reason
			? { action: decision.action, reason: `  ${decision.reason}  ` }
			: { action: decision.action };

		const response = await reviewRoute(admin.accessToken, routeId, body).expect(200);

		expect(response.body).toEqual(expect.objectContaining({ status: decision.target }));
		expect(await storedStatus(routeId)).toBe(decision.target);
		const audits = (await dataSource.query(
			`SELECT "actor_id", "action", "target_type", "before", "after", "reason"
			 FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2`,
			[routeId, decision.auditAction]
		)) as Array<Record<string, unknown>>;
		expect(audits).toEqual([
			expect.objectContaining({
				actor_id: admin.id,
				action: decision.auditAction,
				target_type: "trekking_route",
				before: { status: "pending_approval" },
				after: { status: decision.target },
				reason: decision.reason,
			}),
		]);
	});

	it("enforces authentication, active account, and Admin role without side effects", async () => {
		const admin = await createAccount("admin");
		const inactiveAdmin = await createAccount("admin", "suspended");
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const porter = await createAccount("porter");
		const routeId = await createRoute(await createCampsite(host.id));

		await reviewRoute(undefined, routeId, { action: "approve" }).expect(401);
		await reviewRoute(inactiveAdmin.accessToken, routeId, { action: "approve" }).expect(401);
		await reviewRoute(host.accessToken, routeId, { action: "approve" }).expect(403);
		await reviewRoute(camper.accessToken, routeId, { action: "approve" }).expect(403);
		await reviewRoute(porter.accessToken, routeId, { action: "approve" }).expect(403);
		await listPending(host.accessToken).expect(403);
		expect(await storedStatus(routeId)).toBe("pending_approval");
		await reviewRoute(admin.accessToken, "00000000-0000-4000-8000-000000000099", {
			action: "approve",
		}).expect(404);
	});

	it("returns 409 for every non-pending source state without mutation", async () => {
		const admin = await createAccount("admin");
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);

		for (const status of ["draft", "active", "closed"] as const) {
			const routeId = await createRoute(campsiteId, status);
			await reviewRoute(admin.accessToken, routeId, { action: "approve" }).expect(409);
			expect(await storedStatus(routeId)).toBe(status);
		}
	});

	it("returns 422 for invalid decisions, reasons, forbidden fields, and stored checkpoints", async () => {
		const admin = await createAccount("admin");
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const routeId = await createRoute(campsiteId);
		await createCheckpoint(routeId, true);

		await reviewRoute(admin.accessToken, routeId, { action: "decline", reason: "   " }).expect(422);
		await reviewRoute(admin.accessToken, routeId, {
			action: "non_operable",
			reason: "x".repeat(256),
		}).expect(422);
		await reviewRoute(admin.accessToken, routeId, { action: "active" }).expect(422);
		await reviewRoute(admin.accessToken, routeId, {
			action: "approve",
			status: "active",
		}).expect(422);
		const invalidStored = await reviewRoute(admin.accessToken, routeId, {
			action: "approve",
		}).expect(422);
		expect(JSON.stringify(invalidStored.body.message)).toContain("checkpoints");
		expect(await storedStatus(routeId)).toBe("pending_approval");
	});

	it("serializes concurrent Admin decisions so exactly one succeeds", async () => {
		const firstAdmin = await createAccount("admin");
		const secondAdmin = await createAccount("admin");
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		const responses = await Promise.all([
			reviewRoute(firstAdmin.accessToken, routeId, { action: "approve" }),
			reviewRoute(secondAdmin.accessToken, routeId, {
				action: "decline",
				reason: "Second decision",
			}),
		]);

		expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
		const auditRows = (await dataSource.query(
			`SELECT COUNT(*)::int AS count FROM "audit_logs"
			 WHERE "target_id" = $1 AND "action" IN ('trekking_route.approved', 'trekking_route.declined')`,
			[routeId]
		)) as Array<{ count: number }>;
		expect(auditRows[0].count).toBe(1);
	});

	it("rolls status back when audit insertion fails", async () => {
		const admin = await createAccount("admin");
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await dataSource.query(`CREATE FUNCTION "test_reject_route_review_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action = 'trekking_route.approved' THEN
		     RAISE EXCEPTION 'forced route review audit failure';
		   END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(`CREATE TRIGGER "test_reject_route_review_audit" BEFORE INSERT ON "audit_logs"
		 FOR EACH ROW EXECUTE FUNCTION "test_reject_route_review_audit"()`);

		await reviewRoute(admin.accessToken, routeId, { action: "approve" }).expect(500);
		expect(await storedStatus(routeId)).toBe("pending_approval");
	});
});
