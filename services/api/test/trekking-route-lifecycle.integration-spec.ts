import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

type TestRole = "host" | "admin" | "camper" | "porter";
type RouteStatus = "draft" | "pending_approval" | "active" | "closed";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("CTMS-54 trekking route lifecycle (integration, real PostgreSQL)", () => {
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
		await dataSource.query('DROP TRIGGER IF EXISTS "test_reject_lifecycle_audit" ON "audit_logs"');
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_lifecycle_audit"()');
		if (routeIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [routeIds]);
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
		status: "active" | "suspended" = "active"
	): Promise<TestAccount> {
		const marker = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, 'Lifecycle Test User') RETURNING "id"`,
			[
				`e2e-route-lifecycle-${role}-${marker}@example.com`,
				await hash("S3curePass!", 10),
				role,
				status,
			]
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
			 VALUES ($1, $2, 'lifecycle fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'CTMS54', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `CTMS54 lifecycle campsite ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(campsiteId: string, status: RouteStatus): Promise<string> {
		const geometry = {
			type: "LineString",
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.95],
			],
		};
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			 SELECT $1, $2, 'lifecycle fixture', spatial.line, ST_Length(spatial.line), 'moderate', 120, $4
			 FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography AS line) spatial
			 RETURNING "id"`,
			[
				campsiteId,
				`CTMS54 lifecycle route ${Date.now()}-${Math.random()}`,
				JSON.stringify(geometry),
				status,
			]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	function patchLifecycle(
		token: string | undefined,
		routeId: string,
		action: "close" | "reopen",
		body: object
	) {
		const pending = request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/${action}`)
			.send(body);
		return token ? pending.set("Authorization", `Bearer ${token}`) : pending;
	}

	async function routeStatus(routeId: string): Promise<RouteStatus> {
		const rows = (await dataSource.query('SELECT "status" FROM "trekking_routes" WHERE "id" = $1', [
			routeId,
		])) as Array<{ status: RouteStatus }>;
		return rows[0].status;
	}

	async function lifecycleAudits(routeId: string): Promise<Array<Record<string, unknown>>> {
		return dataSource.query(
			`SELECT "actor_id", "action", "target_type", "before", "after", "reason"
			 FROM "audit_logs" WHERE "target_id" = $1
			 AND "action" IN ('trekking_route.closed', 'trekking_route.reopened')
			 ORDER BY "created_at", "id"`,
			[routeId]
		) as Promise<Array<Record<string, unknown>>>;
	}

	it("persists active to closed with the trimmed reason and exact audit", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "active");

		const response = await patchLifecycle(host.accessToken, routeId, "close", {
			reason: "  Trail is unsafe after heavy rain.  ",
		}).expect(200);

		expect(response.body).toEqual(
			expect.objectContaining({ id: routeId, status: "closed", lengthMeters: expect.any(Number) })
		);
		expect(await routeStatus(routeId)).toBe("closed");
		expect(await lifecycleAudits(routeId)).toEqual([
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route.closed",
				target_type: "trekking_route",
				before: { status: "active" },
				after: { status: "closed" },
				reason: "Trail is unsafe after heavy rain.",
			}),
		]);
	});

	it("persists closed to pending approval and never reopens directly to active", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "closed");

		const response = await patchLifecycle(host.accessToken, routeId, "reopen", {
			reason: "Inspection confirms canonical route data remains valid.",
		}).expect(200);

		expect(response.body.status).toBe("pending_approval");
		expect(await routeStatus(routeId)).toBe("pending_approval");
		expect(await lifecycleAudits(routeId)).toEqual([
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route.reopened",
				before: { status: "closed" },
				after: { status: "pending_approval" },
				reason: "Inspection confirms canonical route data remains valid.",
			}),
		]);
	});

	it("enforces authentication, active accounts, roles, Host ownership, and missing-route semantics", async () => {
		const owner = await createAccount("host");
		const otherHost = await createAccount("host");
		const camper = await createAccount("camper");
		const porter = await createAccount("porter");
		const suspendedHost = await createAccount("host", "suspended");
		const routeId = await createRoute(await createCampsite(owner.id), "active");
		const body = { reason: "Safety closure" };

		await patchLifecycle(undefined, routeId, "close", body).expect(401);
		await patchLifecycle(suspendedHost.accessToken, routeId, "close", body).expect(401);
		await patchLifecycle(camper.accessToken, routeId, "close", body).expect(403);
		await patchLifecycle(porter.accessToken, routeId, "close", body).expect(403);
		await patchLifecycle(otherHost.accessToken, routeId, "close", body).expect(403);
		await patchLifecycle(
			owner.accessToken,
			"00000000-0000-4000-8000-000000000099",
			"close",
			body
		).expect(404);

		expect(await routeStatus(routeId)).toBe("active");
		expect(await lifecycleAudits(routeId)).toEqual([]);
	});

	it("rejects malformed reasons and server-managed fields with 422 and no side effect", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "active");

		for (const body of [
			{},
			{ reason: "   " },
			{ reason: "x".repeat(256) },
			{ reason: "Reason", status: "closed" },
			{ reason: "Reason", previousStatus: "active" },
		]) {
			await patchLifecycle(host.accessToken, routeId, "close", body).expect(422);
		}

		expect(await routeStatus(routeId)).toBe("active");
		expect(await lifecycleAudits(routeId)).toEqual([]);
	});

	it.each([
		["close", "draft"],
		["close", "pending_approval"],
		["close", "closed"],
		["reopen", "draft"],
		["reopen", "pending_approval"],
		["reopen", "active"],
	] as const)("rejects %s from %s with 409 and no mutation", async (action, status) => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), status);

		await patchLifecycle(host.accessToken, routeId, action, {
			reason: "Invalid transition",
		}).expect(409);
		expect(await routeStatus(routeId)).toBe(status);
		expect(await lifecycleAudits(routeId)).toEqual([]);
	});

	it("rejects reopen when canonical stored route integrity is invalid", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "closed");
		await dataSource.query('UPDATE "trekking_routes" SET "name" = $2 WHERE "id" = $1', [
			routeId,
			"",
		]);

		await patchLifecycle(host.accessToken, routeId, "reopen", {
			reason: "Attempt reopen",
		}).expect(409);
		expect(await routeStatus(routeId)).toBe("closed");
		expect(await lifecycleAudits(routeId)).toEqual([]);
	});

	it("allows Admin close and reopen without Host ownership", async () => {
		const owner = await createAccount("host");
		const admin = await createAccount("admin");
		const routeId = await createRoute(await createCampsite(owner.id), "active");

		await patchLifecycle(admin.accessToken, routeId, "close", {
			reason: "Admin safety closure",
		}).expect(200);
		await patchLifecycle(admin.accessToken, routeId, "reopen", {
			reason: "Admin sends route for reapproval",
		}).expect(200);

		expect(await routeStatus(routeId)).toBe("pending_approval");
		expect((await lifecycleAudits(routeId)).map((audit) => audit.actor_id)).toEqual([
			admin.id,
			admin.id,
		]);
	});

	it("serializes concurrent lifecycle requests using the route row lock", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "active");

		const responses = await Promise.all([
			patchLifecycle(host.accessToken, routeId, "close", { reason: "First close" }),
			patchLifecycle(host.accessToken, routeId, "close", { reason: "Concurrent close" }),
		]);

		expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
		expect(await routeStatus(routeId)).toBe("closed");
		expect(await lifecycleAudits(routeId)).toHaveLength(1);
	});

	it("rolls the status update back when audit insertion fails", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "active");
		await dataSource.query(`CREATE FUNCTION "test_reject_lifecycle_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action IN ('trekking_route.closed', 'trekking_route.reopened') THEN
		     RAISE EXCEPTION 'forced lifecycle audit failure';
		   END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(`CREATE TRIGGER "test_reject_lifecycle_audit" BEFORE INSERT ON "audit_logs"
		 FOR EACH ROW EXECUTE FUNCTION "test_reject_lifecycle_audit"()`);

		await patchLifecycle(host.accessToken, routeId, "close", { reason: "Safety closure" }).expect(
			500
		);
		expect(await routeStatus(routeId)).toBe("active");
		expect(await lifecycleAudits(routeId)).toEqual([]);
	});

	it("uses the existing enum and audit reason schema without a migration", async () => {
		const enumRows = (await dataSource.query(
			`SELECT enumlabel FROM pg_enum
			 JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
			 WHERE pg_type.typname = 'trekking_route_status'
			 ORDER BY enumsortorder`
		)) as Array<{ enumlabel: string }>;
		const reasonRows = (await dataSource.query(
			`SELECT character_maximum_length AS "maxLength"
			 FROM information_schema.columns
			 WHERE table_name = 'audit_logs' AND column_name = 'reason'`
		)) as Array<{ maxLength: number }>;

		expect(enumRows.map((row) => row.enumlabel)).toEqual([
			"draft",
			"pending_approval",
			"active",
			"closed",
		]);
		expect(Number(reasonRows[0].maxLength)).toBe(255);
	});
});
