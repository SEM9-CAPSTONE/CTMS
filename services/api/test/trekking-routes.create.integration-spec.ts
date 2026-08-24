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

interface CreateRoutePayload {
	campsiteId: string;
	name: string;
	description?: string;
	geometry: { type: "LineString"; coordinates: number[][] };
	difficulty: "easy" | "moderate" | "hard" | "expert";
	expectedDurationMinutes: number;
}

describe("Trekking routes create/read (integration, real PostGIS)", () => {
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
		await dataSource.query('DROP TRIGGER IF EXISTS "test_reject_route_audit" ON "audit_logs"');
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_route_audit"()');
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

	async function createAccount(role: "host" | "camper"): Promise<TestAccount> {
		const marker = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, 'active', 'Route Test User') RETURNING "id"`,
			[`e2e-route-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role]
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
			 VALUES ($1, $2, 'route fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Route fixture ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	function validPayload(campsiteId: string): CreateRoutePayload {
		return {
			campsiteId,
			name: "  Pine Ridge Traverse  ",
			description: "  A reusable ridge route.  ",
			geometry: {
				type: "LineString",
				coordinates: [
					[108.458313, 11.940419],
					[108.4612, 11.9431],
					[108.4668, 11.9465],
				],
			},
			difficulty: "moderate",
			expectedDurationMinutes: 120,
		};
	}

	function postRoute(token: string | undefined, body: object) {
		const req = request(app.getHttpServer()).post("/api/trekking-routes").send(body);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getRoutes(token: string | undefined, campsiteId: string) {
		const req = request(app.getHttpServer()).get("/api/trekking-routes").query({ campsiteId });
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("returns only routes for the requested campsite owned by the Host", async () => {
		const host = await createAccount("host");
		const firstCampsiteId = await createCampsite(host.id);
		const secondCampsiteId = await createCampsite(host.id);
		const emptyCampsiteId = await createCampsite(host.id);
		const firstRoute = await postRoute(host.accessToken, validPayload(firstCampsiteId)).expect(201);
		const secondRoute = await postRoute(host.accessToken, {
			...validPayload(secondCampsiteId),
			name: "Second campsite route",
		}).expect(201);
		routeIds.push(firstRoute.body.id, secondRoute.body.id);

		const response = await getRoutes(host.accessToken, firstCampsiteId).expect(200);

		expect(response.body).toHaveLength(1);
		expect(response.body[0]).toEqual(
			expect.objectContaining({
				id: firstRoute.body.id,
				campsiteId: firstCampsiteId,
				geometry: validPayload(firstCampsiteId).geometry,
				lengthMeters: expect.any(Number),
				status: "draft",
			})
		);
		expect((await getRoutes(host.accessToken, emptyCampsiteId).expect(200)).body).toEqual([]);
	});

	it("enforces authentication, Host role, and campsite ownership when listing", async () => {
		const owner = await createAccount("host");
		const otherHost = await createAccount("host");
		const camper = await createAccount("camper");
		const campsiteId = await createCampsite(owner.id);
		const created = await postRoute(owner.accessToken, validPayload(campsiteId)).expect(201);
		routeIds.push(created.body.id);

		await getRoutes(undefined, campsiteId).expect(401);
		await getRoutes(camper.accessToken, campsiteId).expect(403);
		await getRoutes(otherHost.accessToken, campsiteId).expect(403);
	});

	it("persists geography(LineString,4326), authoritative length, vertex order, endpoints and audit", async () => {
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const payload = validPayload(campsiteId);
		const response = await postRoute(host.accessToken, payload).expect(201);
		routeIds.push(response.body.id);

		expect(response.body).toEqual(
			expect.objectContaining({
				campsiteId,
				name: "Pine Ridge Traverse",
				description: "A reusable ridge route.",
				geometry: payload.geometry,
				lengthMeters: expect.any(Number),
				difficulty: "moderate",
				expectedDurationMinutes: 120,
				status: "draft",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			})
		);
		expect(response.body.lengthMeters).toBeGreaterThan(0);

		const rows = (await dataSource.query(
			`SELECT ST_SRID("route_geom"::geometry) AS "srid",
			 GeometryType("route_geom"::geometry) AS "geometryType",
			 ST_AsGeoJSON("route_geom"::geometry)::json AS "geometry",
			 ST_NPoints("route_geom"::geometry) AS "vertexCount",
			 ST_AsGeoJSON(ST_StartPoint("route_geom"::geometry))::json AS "start",
			 ST_AsGeoJSON(ST_EndPoint("route_geom"::geometry))::json AS "end",
			 ST_Length("route_geom") AS "calculatedLength", "length_meters" AS "storedLength"
			 FROM "trekking_routes" WHERE "id" = $1`,
			[response.body.id]
		)) as Array<Record<string, unknown>>;
		expect(rows[0]).toEqual(
			expect.objectContaining({
				srid: 4326,
				geometryType: "LINESTRING",
				geometry: payload.geometry,
				vertexCount: 3,
				start: { type: "Point", coordinates: payload.geometry.coordinates[0] },
				end: { type: "Point", coordinates: payload.geometry.coordinates[2] },
			})
		);
		expect(Number(rows[0].storedLength)).toBeCloseTo(Number(rows[0].calculatedLength), 8);

		const audits = (await dataSource.query(
			'SELECT "actor_id", "action", "target_type", "before", "after", "reason" FROM "audit_logs" WHERE "target_id" = $1',
			[response.body.id]
		)) as Array<{ after: Record<string, unknown> }>;
		expect(audits).toHaveLength(1);
		expect(audits[0]).toEqual(
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route.created",
				target_type: "trekking_route",
				before: null,
				reason: "host_create_trekking_route",
			})
		);
		expect(audits[0].after.geometry).toEqual(
			expect.objectContaining({ type: "LineString", vertexCount: 3 })
		);
		expect(JSON.stringify(audits[0].after)).not.toContain(
			JSON.stringify(payload.geometry.coordinates)
		);
	});

	it("enforces authentication, Host role, ownership and missing-campsite semantics without side effects", async () => {
		const owner = await createAccount("host");
		const otherHost = await createAccount("host");
		const camper = await createAccount("camper");
		const campsiteId = await createCampsite(owner.id);
		const payload = validPayload(campsiteId);

		await postRoute(undefined, payload).expect(401);
		await postRoute(camper.accessToken, payload).expect(403);
		await postRoute(otherHost.accessToken, payload).expect(403);
		await postRoute(owner.accessToken, {
			...payload,
			campsiteId: "00000000-0000-4000-8000-000000000099",
		}).expect(404);

		const counts = (await dataSource.query(
			`SELECT (SELECT COUNT(*)::int FROM "trekking_routes" WHERE "campsite_id" = $1) AS routes,
			 (SELECT COUNT(*)::int FROM "audit_logs" WHERE "action" = 'trekking_route.created' AND "actor_id" = ANY($2)) AS audits`,
			[campsiteId, userIds]
		)) as Array<{ routes: number; audits: number }>;
		expect(counts[0]).toEqual({ routes: 0, audits: 0 });
	});

	it("rejects malformed, zero-length and authoritative client fields with 422", async () => {
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const payload = validPayload(campsiteId);

		await postRoute(host.accessToken, {
			...payload,
			geometry: { type: "LineString", coordinates: [[108.45, 11.94]] },
		}).expect(422);
		await postRoute(host.accessToken, {
			...payload,
			geometry: {
				type: "LineString",
				coordinates: [
					[108.45, 11.94],
					[108.45, 11.94],
				],
			},
		}).expect(422);
		await postRoute(host.accessToken, {
			...payload,
			hostId: host.id,
			status: "active",
			lengthMeters: 1,
		}).expect(422);

		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "trekking_routes" WHERE "campsite_id" = $1',
			[campsiteId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});

	it("uses RESTRICT for campsite deletion", async () => {
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		const response = await postRoute(host.accessToken, validPayload(campsiteId)).expect(201);
		routeIds.push(response.body.id);
		await expect(
			dataSource.query('DELETE FROM "campsites" WHERE "id" = $1', [campsiteId])
		).rejects.toMatchObject({ code: "23503" });
	});

	it("rolls route creation back when the audit insert fails", async () => {
		const host = await createAccount("host");
		const campsiteId = await createCampsite(host.id);
		await dataSource.query(`CREATE FUNCTION "test_reject_route_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action = 'trekking_route.created' THEN RAISE EXCEPTION 'forced route audit failure'; END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(`CREATE TRIGGER "test_reject_route_audit" BEFORE INSERT ON "audit_logs"
		 FOR EACH ROW EXECUTE FUNCTION "test_reject_route_audit"()`);

		await postRoute(host.accessToken, validPayload(campsiteId)).expect(500);
		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "trekking_routes" WHERE "campsite_id" = $1',
			[campsiteId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});
});
