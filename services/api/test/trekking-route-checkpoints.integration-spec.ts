import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

type TestRole = "admin" | "camper" | "host" | "porter";
type TestStatus = "active" | "deleted" | "pending_verification" | "suspended";

interface CheckpointPayload {
	name: string;
	location: { type: "Point"; coordinates: [number, number] };
	radiusMeters: number;
	type: "start" | "rest" | "water" | "dangerous" | "emergency_shelter" | "finish";
	expectedArrivalOffset: number;
	instructions: string;
	nearbyWaterOrShelter: boolean;
}

describe("Trekking route checkpoints (integration, real PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let userIds: string[] = [];
	let campsiteIds: string[] = [];
	let routeIds: string[] = [];
	let checkpointIds: string[] = [];

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
		checkpointIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) return;
		await dataSource.query('DROP TRIGGER IF EXISTS "test_reject_checkpoint_audit" ON "audit_logs"');
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_checkpoint_audit"()');
		if (checkpointIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				checkpointIds,
			]);
			await dataSource.query('DELETE FROM "checkpoints" WHERE "id" = ANY($1)', [checkpointIds]);
		}
		if (routeIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [routeIds]);
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
			 VALUES ($1, $2, $3, $4, 'Checkpoint Test User') RETURNING "id"`,
			[`checkpoint-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role, status]
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
			 VALUES ($1, $2, 'checkpoint fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Checkpoint fixture ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(
		campsiteId: string,
		status: "draft" | "pending_approval" | "active" | "closed" = "draft"
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			 SELECT $1, $2, 'checkpoint route', line, ST_Length(line), 'moderate', 120, $3
			 FROM (SELECT ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.94)') AS line) spatial
			 RETURNING "id"`,
			[campsiteId, `Route ${status} ${Date.now()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	function validPayload(longitude = 108.46): CheckpointPayload {
		return {
			name: "  Ridge rest  ",
			location: { type: "Point", coordinates: [longitude, 11.94] },
			radiusMeters: 30,
			type: "rest",
			expectedArrivalOffset: 45,
			instructions: "  Rest and check water.  ",
			nearbyWaterOrShelter: true,
		};
	}

	function postCheckpoint(token: string | undefined, routeId: string, body: object) {
		const req = request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.send(body);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getCheckpoints(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).get(`/api/trekking-routes/${routeId}/checkpoints`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("persists the exact metadata, geography Point, unchanged location, route position, and audit", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const payload = validPayload();
		const response = await postCheckpoint(host.accessToken, routeId, payload).expect(201);
		checkpointIds.push(response.body.id);

		expect(response.body).toEqual(
			expect.objectContaining({
				routeId,
				name: "Ridge rest",
				location: payload.location,
				radiusMeters: 30,
				type: "rest",
				expectedArrivalOffset: 45,
				instructions: "Rest and check water.",
				nearbyWaterOrShelter: true,
				routePosition: expect.any(Number),
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			})
		);

		const rows = (await dataSource.query(
			`SELECT format_type(a.atttypid, a.atttypmod) AS "storageType",
			 GeometryType("location"::geometry) AS "geometryType", ST_SRID("location"::geometry) AS srid,
			 ST_AsGeoJSON("location"::geometry)::json AS location,
			 ST_Distance(route."route_geom", checkpoint."location") AS "distanceMeters",
			 checkpoint."route_position" AS "routePosition"
			 FROM "checkpoints" checkpoint
			 JOIN "trekking_routes" route ON route."id" = checkpoint."route_id"
			 JOIN pg_attribute a ON a.attrelid = 'checkpoints'::regclass AND a.attname = 'location'
			 WHERE checkpoint."id" = $1`,
			[response.body.id]
		)) as Array<Record<string, unknown>>;
		expect(rows[0]).toEqual(
			expect.objectContaining({
				storageType: "geography(Point,4326)",
				geometryType: "POINT",
				srid: 4326,
				location: payload.location,
			})
		);
		expect(Number(rows[0].distanceMeters)).toBeLessThan(0.1);
		expect(Number(rows[0].routePosition)).toBeCloseTo(0.5, 5);

		const audits = (await dataSource.query(
			'SELECT "actor_id", "action", "target_type", "before", "after", "reason" FROM "audit_logs" WHERE "target_id" = $1',
			[response.body.id]
		)) as Array<Record<string, unknown>>;
		expect(audits).toEqual([
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route_checkpoint.created",
				target_type: "trekking_route_checkpoint",
				before: null,
				reason: "host_create_trekking_route_checkpoint",
				after: expect.objectContaining({
					id: response.body.id,
					routeId,
					location: payload.location,
				}),
			}),
		]);
	});

	it("lists owned route checkpoints in deterministic route order", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const later = await postCheckpoint(host.accessToken, routeId, {
			...validPayload(108.466),
			name: "Later",
		}).expect(201);
		const earlier = await postCheckpoint(host.accessToken, routeId, {
			...validPayload(108.452),
			name: "Earlier",
		}).expect(201);
		checkpointIds.push(later.body.id, earlier.body.id);

		const response = await getCheckpoints(host.accessToken, routeId).expect(200);
		expect(response.body.map((item: { name: string }) => item.name)).toEqual(["Earlier", "Later"]);
		expect(response.body[0].routePosition).toBeLessThan(response.body[1].routePosition);
	});

	it("enforces authentication, Host role, ownership, and missing-route semantics", async () => {
		const owner = await createAccount("host");
		const otherHost = await createAccount("host");
		const admin = await createAccount("admin");
		const camper = await createAccount("camper");
		const porter = await createAccount("porter");
		const routeId = await createRoute(await createCampsite(owner.id));
		const payload = validPayload();

		await postCheckpoint(undefined, routeId, payload).expect(401);
		await postCheckpoint(admin.accessToken, routeId, payload).expect(403);
		await postCheckpoint(camper.accessToken, routeId, payload).expect(403);
		await postCheckpoint(porter.accessToken, routeId, payload).expect(403);
		await postCheckpoint(otherHost.accessToken, routeId, payload).expect(403);
		await getCheckpoints(otherHost.accessToken, routeId).expect(403);
		await postCheckpoint(owner.accessToken, "00000000-0000-4000-8000-000000000099", payload).expect(
			404
		);
		await getCheckpoints(owner.accessToken, "00000000-0000-4000-8000-000000000099").expect(404);

		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "checkpoints" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});

	it.each(["pending_verification", "suspended", "deleted"] as const)(
		"returns 401 for a %s Host account without side effects",
		async (status) => {
			const owner = await createAccount("host");
			const inactiveHost = await createAccount("host", status);
			const routeId = await createRoute(await createCampsite(owner.id));

			await postCheckpoint(inactiveHost.accessToken, routeId, validPayload()).expect(401);
			const rows = (await dataSource.query(
				'SELECT COUNT(*)::int AS count FROM "checkpoints" WHERE "route_id" = $1',
				[routeId]
			)) as Array<{ count: number }>;
			expect(rows[0].count).toBe(0);
		}
	);

	it.each(["pending_approval", "active", "closed"] as const)(
		"returns 409 when creating on a %s route",
		async (status) => {
			const host = await createAccount("host");
			const routeId = await createRoute(await createCampsite(host.id), status);
			await postCheckpoint(host.accessToken, routeId, validPayload()).expect(409);
			const rows = (await dataSource.query(
				'SELECT COUNT(*)::int AS count FROM "checkpoints" WHERE "route_id" = $1',
				[routeId]
			)) as Array<{ count: number }>;
			expect(rows[0].count).toBe(0);
		}
	);

	it("rejects invalid metadata, server-managed fields, excessive offset, and points over 50 meters away with 422", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const payload = validPayload();
		const { location: _location, ...withoutLocation } = payload;

		await postCheckpoint(host.accessToken, routeId, withoutLocation).expect(422);
		await postCheckpoint(host.accessToken, routeId, { ...payload, radiusMeters: 9 }).expect(422);
		await postCheckpoint(host.accessToken, routeId, { ...payload, type: "viewpoint" }).expect(422);
		await postCheckpoint(host.accessToken, routeId, {
			...payload,
			expectedArrivalOffset: 121,
		}).expect(422);
		await postCheckpoint(host.accessToken, routeId, {
			...payload,
			location: { type: "Point", coordinates: [108.46, 11.95] },
		}).expect(422);
		await postCheckpoint(host.accessToken, routeId, {
			...payload,
			id: "00000000-0000-4000-8000-000000000001",
			routePosition: 0.5,
		}).expect(422);
		await postCheckpoint(host.accessToken, routeId, {
			...payload,
			location: { ...payload.location, routeId },
		}).expect(422);
		await postCheckpoint(host.accessToken, "not-a-uuid", payload).expect(422);

		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "checkpoints" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});

	it("enforces database constraints and RESTRICT route deletion", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const created = await postCheckpoint(host.accessToken, routeId, validPayload()).expect(201);
		checkpointIds.push(created.body.id);

		await expect(
			dataSource.query('UPDATE "checkpoints" SET "radius_m" = 501 WHERE "id" = $1', [
				created.body.id,
			])
		).rejects.toMatchObject({ code: "23514" });
		await expect(
			dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = $1', [routeId])
		).rejects.toMatchObject({ code: "23503" });
	});

	it("rolls checkpoint creation back when its audit insert fails", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await dataSource.query(`CREATE FUNCTION "test_reject_checkpoint_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action = 'trekking_route_checkpoint.created' THEN RAISE EXCEPTION 'forced checkpoint audit failure'; END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(`CREATE TRIGGER "test_reject_checkpoint_audit" BEFORE INSERT ON "audit_logs"
		 FOR EACH ROW EXECUTE FUNCTION "test_reject_checkpoint_audit"()`);

		await postCheckpoint(host.accessToken, routeId, validPayload()).expect(500);
		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "checkpoints" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});
});
