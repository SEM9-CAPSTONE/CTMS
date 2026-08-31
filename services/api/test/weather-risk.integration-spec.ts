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

describe("Weather Risk Score (integration, real PostGIS + real Open-Meteo)", () => {
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

		const rules = await dataSource.query('SELECT * FROM "weather_risk_rules"');
		if (rules.length === 0) {
			await dataSource.query(`
				INSERT INTO "weather_risk_rules" (
					"rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold",
					"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
					"visibility_yellow_threshold", "visibility_red_threshold",
					"thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
					"green_max_score", "yellow_max_score",
					"is_active"
				) VALUES (
					10.0, 50.0,
					40.0, 70.0,
					5.0, 0.0, 38.0, 42.0,
					5000.0, 1000.0,
					true, true,
					0.30, 0.25, 0.15, 0.15, 0.15,
					0.5, 1.2,
					true
				)
			`);
			console.log("Seeded default weather risk rules for integration tests.");
		}
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
			await dataSource.query('DELETE FROM "weather_risk_assessments" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
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
			 VALUES ($1, $2, $3, 'active', 'Weather Risk Test User') RETURNING "id"`,
			[`weather-risk-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role]
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
			 VALUES ($1, $2, 'weather risk fixture', ST_SetSRID(ST_MakePoint(108.22, 16.06), 4326)::geography,
			 'Da Nang', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Weather risk fixture ${Date.now()}`]
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
			 SELECT $1, $2, 'weather risk route', line, ST_Length(line), 'moderate', 120, $3
			 FROM (SELECT ST_GeogFromText('SRID=4326;LINESTRING(108.22 16.06,108.24 16.06)') AS line) spatial
			 RETURNING "id"`,
			[campsiteId, `Route ${status} ${Date.now()}`, status]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	function refreshWeather(token: string, routeId: string) {
		return request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/weather/refresh`)
			.set("Authorization", `Bearer ${token}`);
	}

	function calculateRisk(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).post(
			`/api/trekking-routes/${routeId}/weather/risk-score`
		);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getLatestRisk(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).get(
			`/api/trekking-routes/${routeId}/weather/risk-score/latest`
		);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("calculates, persists and retrieves risk score for active route after refresh", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		// 1. Refresh weather snapshot
		await refreshWeather(host.accessToken, routeId).expect(201);

		// 2. Calculate risk score
		const response = await calculateRisk(host.accessToken, routeId).expect(201);

		expect(response.body).toEqual(
			expect.objectContaining({
				routeId,
				snapshotId: expect.any(String),
				ruleVersionId: expect.any(String),
				riskLevel: expect.any(String),
				compositeScore: expect.any(Number),
				criteriaScores: expect.any(Object),
				createdBy: host.id,
			})
		);

		const firstId = response.body.id;

		// 3. Verify database record
		const rows = (await dataSource.query(
			'SELECT * FROM "weather_risk_assessments" WHERE "route_id" = $1',
			[routeId]
		)) as Array<Record<string, unknown>>;
		expect(rows).toHaveLength(1);

		// 4. Idempotency test (should return the existing assessment row)
		const response2 = await calculateRisk(host.accessToken, routeId).expect(201);
		expect(response2.body.id).toBe(firstId);

		// 5. Get latest risk
		const latest = await getLatestRisk(host.accessToken, routeId).expect(200);
		expect(latest.body.id).toBe(firstId);
	}, 30000);

	it("returns 409 when calculating risk without a weather snapshot", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await calculateRisk(host.accessToken, routeId).expect(409);
	});

	it("returns 404 for a route that does not exist", async () => {
		const host = await createAccount("host");
		await calculateRisk(host.accessToken, "00000000-0000-0000-0000-000000000000").expect(404);
	});

	it("returns 403 when a different Host calculates risk for a route they do not own", async () => {
		const owner = await createAccount("host");
		const intruder = await createAccount("host");
		const routeId = await createRoute(await createCampsite(owner.id));

		await calculateRisk(intruder.accessToken, routeId).expect(403);
	});

	it("lets an Admin calculate risk for a route owned by someone else", async () => {
		const owner = await createAccount("host");
		const admin = await createAccount("admin");
		const routeId = await createRoute(await createCampsite(owner.id));

		await refreshWeather(owner.accessToken, routeId).expect(201);
		await calculateRisk(admin.accessToken, routeId).expect(201);
	}, 30000);

	it("returns 409 and creates no assessment when the route is not active (BR-243: no side effect)", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "draft");

		await calculateRisk(host.accessToken, routeId).expect(409);

		const rows = (await dataSource.query(
			'SELECT * FROM "weather_risk_assessments" WHERE "route_id" = $1',
			[routeId]
		)) as unknown[];
		expect(rows).toHaveLength(0);
	});

	it("returns 401 without an access token", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await calculateRisk(undefined, routeId).expect(401);
	});

	it("returns 403 for a Camper", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));

		await calculateRisk(camper.accessToken, routeId).expect(403);
	});

	it("getLatestRisk returns 200 with an empty body when no assessment exists", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		const response = await getLatestRisk(host.accessToken, routeId).expect(200);
		expect(response.body).toEqual({});
	});
});
