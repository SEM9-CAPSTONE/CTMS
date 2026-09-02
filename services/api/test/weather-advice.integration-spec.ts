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
 * CTMS-29-T01. Real Postgres + real HTTP calls to the project's own
 * `services/ai` FastAPI container (`AI_SERVICE_URL`, see services/api/.env)
 * -- never mocked, matching weather-risk.integration-spec.ts's own real-infra
 * convention. As of this branch there is no real `OPENAI_API_KEY` configured
 * (see the CTMS-29 spec's own "Deferred" note): the `ai` container is up and
 * reachable, but every real advice-generation call it receives honestly
 * fails with its own 503 ("missing OPENAI_API_KEY"). The happy-path
 * "generate a brand new advice from the LLM" case is therefore exercised
 * here only via the honest 503-after-retries outcome (with zero DB writes);
 * the idempotent-return-of-an-already-generated-advice case is instead
 * exercised by seeding a real row directly, so the request/response/DB
 * mapping is still verified end-to-end for real. Once a real key is
 * configured this suite's 503 test should be replaced with a real success
 * assertion -- tracked as the same deferred item recorded in the spec doc.
 */
describe("Weather Advice (integration, real Postgres + real ai microservice)", () => {
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
			// weather_advice cascades on delete from weather_risk_assessments (FK ON DELETE CASCADE).
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
			 VALUES ($1, $2, $3, 'active', 'Weather Advice Test User') RETURNING "id"`,
			[`weather-advice-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role]
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
			 VALUES ($1, $2, 'weather advice fixture', ST_SetSRID(ST_MakePoint(108.22, 16.06), 4326)::geography,
			 'Da Nang', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Weather advice fixture ${Date.now()}`]
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
			 SELECT $1, $2, 'weather advice route', line, ST_Length(line), 'moderate', 120, $3
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

	function calculateRisk(token: string, routeId: string) {
		return request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/weather/risk-score`)
			.set("Authorization", `Bearer ${token}`);
	}

	function generateAdvice(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).post(`/api/trekking-routes/${routeId}/weather/advice`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getLatestAdvice(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).get(
			`/api/trekking-routes/${routeId}/weather/advice/latest`
		);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	/** Sets up an active route with a real, persisted risk assessment -- the
	 * one precondition every advice-generation test needs. */
	async function createRouteWithAssessment(
		host: TestAccount
	): Promise<{ routeId: string; assessmentId: string }> {
		const routeId = await createRoute(await createCampsite(host.id));
		await refreshWeather(host.accessToken, routeId).expect(201);
		const risk = await calculateRisk(host.accessToken, routeId).expect(201);
		return { routeId, assessmentId: risk.body.id };
	}

	it("returns 404 for a route that does not exist", async () => {
		const host = await createAccount("host");
		await generateAdvice(host.accessToken, "00000000-0000-0000-0000-000000000000").expect(404);
	});

	it("returns 403 when a different Host generates advice for a route they do not own", async () => {
		const owner = await createAccount("host");
		const intruder = await createAccount("host");
		const routeId = await createRoute(await createCampsite(owner.id));

		await generateAdvice(intruder.accessToken, routeId).expect(403);
	});

	it("returns 401 without an access token", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await generateAdvice(undefined, routeId).expect(401);
	});

	it("returns 403 for a Camper", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));

		await generateAdvice(camper.accessToken, routeId).expect(403);
	});

	it("returns 409 and creates no advice when the route is not active (BR-243: no side effect)", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id), "draft");

		await generateAdvice(host.accessToken, routeId).expect(409);

		const rows = await dataSource.query(
			'SELECT wa.* FROM "weather_advice" wa JOIN "weather_risk_assessments" a ON a.id = wa.assessment_id WHERE a."route_id" = $1',
			[routeId]
		);
		expect(rows).toHaveLength(0);
	});

	it("returns 409 when no risk assessment exists yet for the route", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await generateAdvice(host.accessToken, routeId).expect(409);
	});

	it("returns 503 and persists nothing when the ai service has no configured OpenAI key (deferred real LLM call, see spec doc)", async () => {
		const host = await createAccount("host");
		const { assessmentId } = await createRouteWithAssessment(host);
		const routeId = (
			await dataSource.query('SELECT "route_id" FROM "weather_risk_assessments" WHERE "id" = $1', [
				assessmentId,
			])
		)[0].route_id;

		await generateAdvice(host.accessToken, routeId).expect(503);

		const rows = await dataSource.query(
			'SELECT * FROM "weather_advice" WHERE "assessment_id" = $1',
			[assessmentId]
		);
		expect(rows).toHaveLength(0);
	}, 15000);

	it("returns the same existing advice on a repeat request without needing the ai service (idempotency / BR-230)", async () => {
		const host = await createAccount("host");
		const { routeId, assessmentId } = await createRouteWithAssessment(host);

		const seeded = (
			await dataSource.query(
				`INSERT INTO "weather_advice" ("assessment_id", "advice_text", "actions", "created_by")
				 VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
				[
					assessmentId,
					"Điều kiện ở mức cảnh báo nhẹ, nên chuẩn bị áo mưa.",
					JSON.stringify(["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"]),
					host.id,
				]
			)
		)[0];

		const response = await generateAdvice(host.accessToken, routeId).expect(201);
		expect(response.body).toEqual(
			expect.objectContaining({
				id: seeded.id,
				assessmentId,
				adviceText: seeded.advice_text,
				actions: ["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"],
				createdBy: host.id,
			})
		);

		const latest = await getLatestAdvice(host.accessToken, routeId).expect(200);
		expect(latest.body.id).toBe(seeded.id);

		const rows = await dataSource.query(
			'SELECT * FROM "weather_advice" WHERE "assessment_id" = $1',
			[assessmentId]
		);
		expect(rows).toHaveLength(1);
	});

	it("lets an Admin read latest advice for a route owned by someone else", async () => {
		const owner = await createAccount("host");
		const admin = await createAccount("admin");
		const routeId = await createRoute(await createCampsite(owner.id));

		const response = await getLatestAdvice(admin.accessToken, routeId).expect(200);
		expect(response.body).toEqual({});
	});

	it("getLatestAdvice returns 404 for a route that does not exist", async () => {
		const host = await createAccount("host");
		await getLatestAdvice(host.accessToken, "00000000-0000-0000-0000-000000000000").expect(404);
	});

	it("getLatestAdvice returns 403 when a different Host reads a route they do not own", async () => {
		const owner = await createAccount("host");
		const intruder = await createAccount("host");
		const routeId = await createRoute(await createCampsite(owner.id));

		await getLatestAdvice(intruder.accessToken, routeId).expect(403);
	});

	it("getLatestAdvice returns 200 with an empty body when no advice exists", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		const response = await getLatestAdvice(host.accessToken, routeId).expect(200);
		expect(response.body).toEqual({});
	});
});
