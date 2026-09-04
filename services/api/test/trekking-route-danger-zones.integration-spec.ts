import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { WeatherRiskRulesService } from "../src/modules/weather/services/weather-risk-rules.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

type TestRole = "admin" | "camper" | "host" | "porter";
type TestStatus = "active" | "deleted" | "pending_verification" | "suspended";
type RouteStatus = "active" | "closed" | "draft" | "pending_approval";
type Severity = "high" | "low" | "medium";

interface PointGeometry {
	type: "Point";
	coordinates: [number, number];
}

interface PolygonGeometry {
	type: "Polygon";
	coordinates: Array<Array<[number, number]>>;
}

interface DangerZonePayload {
	geometry: PointGeometry | PolygonGeometry;
	radiusMeters?: number;
	description: string;
	severity: Severity;
}

describe("Trekking route danger zones (integration, real PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let userIds: string[] = [];
	let campsiteIds: string[] = [];
	let routeIds: string[] = [];
	let dangerZoneIds: string[] = [];

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(WeatherRiskRulesService)
			.useValue({})
			.compile();
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
		dangerZoneIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) return;
		await dataSource.query(
			'DROP TRIGGER IF EXISTS "test_reject_danger_zone_audit" ON "audit_logs"'
		);
		await dataSource.query('DROP FUNCTION IF EXISTS "test_reject_danger_zone_audit"()');
		if (dangerZoneIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				dangerZoneIds,
			]);
		}
		if (routeIds.length > 0) {
			await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
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
			 VALUES ($1, $2, $3, $4, 'Danger Zone Test User') RETURNING "id"`,
			[`danger-zone-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role, status]
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
			 VALUES ($1, $2, 'danger zone fixture', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography,
			 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Danger zone fixture ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(campsiteId: string, status: RouteStatus = "draft"): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			 SELECT $1, $2, 'danger zone route', line, ST_Length(line), 'moderate', 120, $3
			 FROM (SELECT ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.94)') AS line) spatial
			 RETURNING "id"`,
			[campsiteId, `Route ${status} ${Date.now()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	function pointPayload(overrides: Partial<DangerZonePayload> = {}): DangerZonePayload {
		return {
			geometry: { type: "Point", coordinates: [108.46, 11.94] },
			radiusMeters: 50,
			description: "  Falling-rock area  ",
			severity: "medium",
			...overrides,
		};
	}

	function polygonPayload(overrides: Partial<DangerZonePayload> = {}): DangerZonePayload {
		return {
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[108.45, 11.94],
						[108.46, 11.94],
						[108.46, 11.95],
						[108.45, 11.94],
					],
				],
			},
			description: "  Landslide area  ",
			severity: "high",
			...overrides,
		};
	}

	function postDangerZone(token: string | undefined, routeId: string, body: object) {
		const req = request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/hazard-areas`)
			.send(body);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getDangerZones(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).get(`/api/trekking-routes/${routeId}/hazard-areas`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("applies the route_danger_zones migration with the approved physical schema", async () => {
		const columns = (await dataSource.query(
			`SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
			 FROM pg_attribute a
			 WHERE a.attrelid = 'route_danger_zones'::regclass AND a.attnum > 0 AND NOT a.attisdropped
			 ORDER BY a.attnum`
		)) as Array<{ name: string; type: string }>;
		expect(columns).toEqual([
			{ name: "id", type: "uuid" },
			{ name: "route_id", type: "uuid" },
			{ name: "geom", type: "geography(Geometry,4326)" },
			{ name: "radius_m", type: "double precision" },
			{ name: "description", type: "character varying(1000)" },
			{ name: "severity", type: "route_danger_zone_severity" },
			{ name: "created_at", type: "timestamp with time zone" },
			{ name: "updated_at", type: "timestamp with time zone" },
		]);
		const severities = (await dataSource.query(
			`SELECT enumlabel AS value
			 FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
			 WHERE pg_type.typname = 'route_danger_zone_severity'
			 ORDER BY enumsortorder`
		)) as Array<{ value: string }>;
		expect(severities.map(({ value }) => value)).toEqual(["low", "medium", "high"]);
		const indexes = (await dataSource.query(
			`SELECT indexname FROM pg_indexes WHERE tablename = 'route_danger_zones' ORDER BY indexname`
		)) as Array<{ indexname: string }>;
		expect(indexes.map(({ indexname }) => indexname)).toEqual(
			expect.arrayContaining(["IDX_route_danger_zones_geom", "IDX_route_danger_zones_route_id"])
		);
	});

	it("creates, audits, persists, and reads authoritative Point-plus-radius data", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const payload = pointPayload();
		const created = await postDangerZone(host.accessToken, routeId, payload).expect(201);
		dangerZoneIds.push(created.body.id);
		expect(created.body).toEqual(
			expect.objectContaining({
				routeId,
				geometry: payload.geometry,
				radiusMeters: 50,
				description: "Falling-rock area",
				severity: "medium",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			})
		);

		const stored = (await dataSource.query(
			`SELECT GeometryType("geom"::geometry) AS "geometryType", ST_SRID("geom"::geometry) AS srid,
			 ST_IsValid("geom"::geometry) AS valid, ST_AsGeoJSON("geom"::geometry)::json AS geometry,
			 "radius_m" AS "radiusMeters", "description", "severity", "route_id" AS "routeId"
			 FROM "route_danger_zones" WHERE "id" = $1`,
			[created.body.id]
		)) as Array<Record<string, unknown>>;
		expect(stored).toEqual([
			expect.objectContaining({
				geometryType: "POINT",
				srid: 4326,
				valid: true,
				geometry: payload.geometry,
				radiusMeters: 50,
				description: "Falling-rock area",
				severity: "medium",
				routeId,
			}),
		]);

		const listed = await getDangerZones(host.accessToken, routeId).expect(200);
		expect(listed.body).toEqual([created.body]);
		const audits = (await dataSource.query(
			'SELECT "actor_id", "action", "target_type", "before", "after", "reason" FROM "audit_logs" WHERE "target_id" = $1',
			[created.body.id]
		)) as Array<Record<string, unknown>>;
		expect(audits).toEqual([
			expect.objectContaining({
				actor_id: host.id,
				action: "trekking_route_danger_zone.created",
				target_type: "trekking_route_danger_zone",
				before: null,
				reason: "host_create_trekking_route_danger_zone",
				after: expect.objectContaining({ id: created.body.id, routeId }),
			}),
		]);
	});

	it("stores a valid Polygon with null radius and returns it authoritatively", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const payload = polygonPayload();
		const created = await postDangerZone(host.accessToken, routeId, payload).expect(201);
		dangerZoneIds.push(created.body.id);
		expect(created.body).toEqual(
			expect.objectContaining({
				geometry: payload.geometry,
				radiusMeters: null,
				description: "Landslide area",
				severity: "high",
			})
		);
		const stored = (await dataSource.query(
			`SELECT GeometryType("geom"::geometry) AS "geometryType", ST_SRID("geom"::geometry) AS srid,
			 ST_IsValid("geom"::geometry) AS valid, "radius_m" AS "radiusMeters"
			 FROM "route_danger_zones" WHERE "id" = $1`,
			[created.body.id]
		)) as Array<Record<string, unknown>>;
		expect(stored).toEqual([
			expect.objectContaining({
				geometryType: "POLYGON",
				srid: 4326,
				valid: true,
				radiusMeters: null,
			}),
		]);
		const listed = await getDangerZones(host.accessToken, routeId).expect(200);
		expect(listed.body).toEqual([created.body]);
	});

	it("accepts low severity and a description exactly 1000 characters long", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const created = await postDangerZone(
			host.accessToken,
			routeId,
			pointPayload({ description: "d".repeat(1000), severity: "low" })
		).expect(201);
		dangerZoneIds.push(created.body.id);
		expect(created.body).toEqual(
			expect.objectContaining({ description: "d".repeat(1000), severity: "low" })
		);
	});

	it("returns an empty authoritative collection for an owned Route without danger zones", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await getDangerZones(host.accessToken, routeId).expect(200, []);
	});

	it("enforces authentication, active-account, Host-role, ownership, and missing-Route semantics", async () => {
		const owner = await createAccount("host");
		const inactiveHost = await createAccount("host", "suspended");
		const otherHost = await createAccount("host");
		const admin = await createAccount("admin");
		const camper = await createAccount("camper");
		const porter = await createAccount("porter");
		const routeId = await createRoute(await createCampsite(owner.id));
		const payload = pointPayload();

		await postDangerZone(undefined, routeId, payload).expect(401);
		await postDangerZone(inactiveHost.accessToken, routeId, payload).expect(401);
		await postDangerZone(admin.accessToken, routeId, payload).expect(403);
		await postDangerZone(camper.accessToken, routeId, payload).expect(403);
		await postDangerZone(porter.accessToken, routeId, payload).expect(403);
		await postDangerZone(otherHost.accessToken, routeId, payload).expect(403);
		await getDangerZones(otherHost.accessToken, routeId).expect(403);
		await postDangerZone(owner.accessToken, "00000000-0000-4000-8000-000000000099", payload).expect(
			404
		);
		await getDangerZones(owner.accessToken, "00000000-0000-4000-8000-000000000099").expect(404);

		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});

	it.each(["pending_approval", "active", "closed"] as const)(
		"returns 409 without side effects when creating on a %s Route",
		async (status) => {
			const host = await createAccount("host");
			const routeId = await createRoute(await createCampsite(host.id), status);
			await postDangerZone(host.accessToken, routeId, pointPayload()).expect(409);
			const rows = (await dataSource.query(
				'SELECT COUNT(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1',
				[routeId]
			)) as Array<{ count: number }>;
			expect(rows[0].count).toBe(0);
		}
	);

	it("rejects malformed contracts with 422 and creates no danger-zone or audit rows", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const invalidPayloads: object[] = [
			{ ...pointPayload(), radiusMeters: undefined },
			{ ...pointPayload(), radiusMeters: 0 },
			{ ...pointPayload(), radiusMeters: -1 },
			{ ...polygonPayload(), radiusMeters: 10 },
			{ ...pointPayload(), geometry: {} },
			{ ...pointPayload(), geometry: { type: "LineString", coordinates: [] } },
			{ ...pointPayload(), geometry: { type: "Point", coordinates: [181, 11.94] } },
			{ ...pointPayload(), description: "   " },
			{ ...pointPayload(), description: "d".repeat(1001) },
			{ ...pointPayload(), severity: "critical" },
			{ ...pointPayload(), routeId, createdAt: "now" },
		];
		for (const payload of invalidPayloads) {
			await postDangerZone(host.accessToken, routeId, payload).expect(422);
		}
		await postDangerZone(host.accessToken, "not-a-uuid", pointPayload()).expect(422);

		const dangerZones = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		const audits = (await dataSource.query(
			`SELECT COUNT(*)::int AS count FROM "audit_logs"
			 WHERE "action" = 'trekking_route_danger_zone.created' AND "actor_id" = $1`,
			[host.id]
		)) as Array<{ count: number }>;
		expect(dangerZones[0].count).toBe(0);
		expect(audits[0].count).toBe(0);
	});

	it("lets PostGIS reject a self-intersecting Polygon with 422 and no side effects", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const geometry: PolygonGeometry = {
			type: "Polygon",
			coordinates: [
				[
					[108.45, 11.94],
					[108.46, 11.95],
					[108.45, 11.95],
					[108.46, 11.94],
					[108.45, 11.94],
				],
			],
		};
		await postDangerZone(host.accessToken, routeId, polygonPayload({ geometry })).expect(422);
		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});

	it("enforces database radius, geometry, and Route foreign-key constraints", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		const created = await postDangerZone(host.accessToken, routeId, pointPayload()).expect(201);
		dangerZoneIds.push(created.body.id);
		await expect(
			dataSource.query('UPDATE "route_danger_zones" SET "radius_m" = NULL WHERE "id" = $1', [
				created.body.id,
			])
		).rejects.toMatchObject({ code: "23514" });
		await expect(
			dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = $1', [routeId])
		).rejects.toMatchObject({ code: "23503" });
		await expect(
			dataSource.query(
				`INSERT INTO "route_danger_zones" ("route_id", "geom", "radius_m", "description", "severity")
				 VALUES ('00000000-0000-4000-8000-000000000099',
				 ST_SetSRID(ST_MakePoint(108.46, 11.94), 4326)::geography, 10, 'missing route', 'low')`
			)
		).rejects.toMatchObject({ code: "23503" });
	});

	it("rolls danger-zone persistence back when audit insertion fails", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));
		await dataSource.query(`CREATE FUNCTION "test_reject_danger_zone_audit"() RETURNS trigger AS $$
		 BEGIN
		   IF NEW.action = 'trekking_route_danger_zone.created' THEN RAISE EXCEPTION 'forced danger-zone audit failure'; END IF;
		   RETURN NEW;
		 END; $$ LANGUAGE plpgsql`);
		await dataSource.query(`CREATE TRIGGER "test_reject_danger_zone_audit" BEFORE INSERT ON "audit_logs"
		 FOR EACH ROW EXECUTE FUNCTION "test_reject_danger_zone_audit"()`);

		await postDangerZone(host.accessToken, routeId, pointPayload()).expect(500);
		const rows = (await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1',
			[routeId]
		)) as Array<{ count: number }>;
		expect(rows[0].count).toBe(0);
	});
});
