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

/**
 * CTMS-25-T01. Real Postgres/PostGIS + a REAL call to the live Open-Meteo
 * API (no mocking of the external provider) -- same "no mocking" posture
 * this codebase already uses for real SMTP OTP delivery in
 * auth.register.integration-spec.ts. Open-Meteo needs no API key, so this
 * runs anywhere with network access.
 */
describe("Weather snapshots (integration, real PostGIS + real Open-Meteo)", () => {
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
	}, 30000);

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
		if (routeIds.length > 0) {
			await dataSource.query('DELETE FROM "weather_snapshots" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
		}
		if (campsiteIds.length > 0) {
			await dataSource.query('DELETE FROM "campsites" WHERE "id" = ANY($1)', [campsiteIds]);
		}
		if (userIds.length > 0) {
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
	});

	async function createAccount(role: TestRole): Promise<TestAccount> {
		const marker = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, 'active', 'Weather Test User') RETURNING "id"`,
			[`weather-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role]
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
			 VALUES ($1, $2, 'weather fixture', ST_SetSRID(ST_MakePoint(108.22, 16.06), 4326)::geography,
			 'Da Nang', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Weather fixture ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(
		campsiteId: string,
		status: "draft" | "active" = "active"
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			 SELECT $1, $2, 'weather route', line, ST_Length(line), 'moderate', 120, $3
			 FROM (SELECT ST_GeogFromText('SRID=4326;LINESTRING(108.22 16.06,108.24 16.06)') AS line) spatial
			 RETURNING "id"`,
			[campsiteId, `Route ${status} ${Date.now()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	function refresh(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).post(
			`/api/trekking-routes/${routeId}/weather/refresh`
		);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getLatest(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).get(`/api/trekking-routes/${routeId}/weather/latest`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("fetches real weather for the route's centroid, persists it, and getLatest returns the same row", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		const response = await refresh(host.accessToken, routeId).expect(201);

		expect(response.body).toEqual(
			expect.objectContaining({
				routeId,
				status: "success",
				observedAt: expect.any(String),
				rainfallMm: expect.any(Number),
				windKph: expect.any(Number),
				temperatureC: expect.any(Number),
				visibilityM: expect.any(Number),
				thunderstorm: expect.any(Boolean),
				errorMessage: null,
			})
		);

		const rows = (await dataSource.query(
			'SELECT * FROM "weather_snapshots" WHERE "route_id" = $1',
			[routeId]
		)) as Array<Record<string, unknown>>;
		expect(rows).toHaveLength(1);
		expect(rows[0].provider_response).not.toBeNull();

		const latest = await getLatest(host.accessToken, routeId).expect(200);
		expect(latest.body.id).toBe(response.body.id);
	}, 20000);

	it("returns 404 for a route that does not exist", async () => {
		const host = await createAccount("host");
		await refresh(host.accessToken, "00000000-0000-0000-0000-000000000000").expect(404);
	});

	it("returns 403 when a different Host refreshes weather for a route they do not own", async () => {
		const owner = await createAccount("host");
		const intruder = await createAccount("host");
		const routeId = await createRoute(await createCampsite(owner.id));

		await refresh(intruder.accessToken, routeId).expect(403);
	});

	it("lets an Admin refresh weather for a route owned by someone else", async () => {
		const owner = await createAccount("host");
		const admin = await createAccount("admin");
		const routeId = await createRoute(await createCampsite(owner.id));

		await refresh(admin.accessToken, routeId).expect(201);
	}, 20000);

	it("returns 409 and creates no snapshot at all when the route is not active (BR-243: no side effect)", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "draft");

		await refresh(host.accessToken, routeId).expect(409);

		const rows = (await dataSource.query(
			'SELECT * FROM "weather_snapshots" WHERE "route_id" = $1',
			[routeId]
		)) as unknown[];
		expect(rows).toHaveLength(0);
	});

	it("returns 401 without an access token", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await refresh(undefined, routeId).expect(401);
	});

	it("returns 403 for a Camper -- role alone is not enough", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));

		await refresh(camper.accessToken, routeId).expect(403);
	});

	it("getLatest returns 200 with an empty body when no snapshot has ever been recorded", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		// NestJS serializes a `null` controller return as an empty JSON body
		// -- supertest parses that as `{}`, not `null` (verified against a
		// real request/response, not assumed).
		const response = await getLatest(host.accessToken, routeId).expect(200);
		expect(response.body).toEqual({});
	});
});
