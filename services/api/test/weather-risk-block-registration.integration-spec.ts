import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { RiskLevel } from "../src/modules/weather/entities/weather-risk-assessment.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

type TestRole = "admin" | "camper" | "host" | "porter";

describe("Block New Registrations when Route Risk Is Red (integration, real DB)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let userIds: string[] = [];
	let campsiteIds: string[] = [];
	let routeIds: string[] = [];
	let tripIds: string[] = [];
	let activeRuleId: string;

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

		const rules = (await dataSource.query(
			'SELECT * FROM "weather_risk_rules" WHERE "is_active" = true'
		)) as Array<{ id: string }>;
		if (rules.length > 0) {
			activeRuleId = rules[0].id;
		} else {
			const rows = (await dataSource.query(`
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
				) RETURNING "id"
			`)) as Array<{ id: string }>;
			activeRuleId = rows[0].id;
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
		tripIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) return;
		if (tripIds.length > 0) {
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
		}
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

	async function createAccount(
		role: TestRole,
		status: "active" | "suspended" = "active"
	): Promise<TestAccount> {
		const marker = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, 'Registration Risk Test User') RETURNING "id"`,
			[`block-reg-${role}-${marker}@example.com`, await hash("S3curePass!", 10), role, status]
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
			 VALUES ($1, $2, 'block reg fixture', ST_SetSRID(ST_MakePoint(108.22, 16.06), 4326)::geography,
			 'Da Nang', '{}'::jsonb, '{}'::jsonb, 'draft') RETURNING "id"`,
			[hostId, `Block reg fixture ${Date.now()}`]
		)) as Array<{ id: string }>;
		campsiteIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createRoute(campsiteId: string): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes"
			 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
			  "expected_duration_minutes", "status")
			 SELECT $1, $2, 'block reg route', line, ST_Length(line), 'moderate', 120, 'active'
			 FROM (SELECT ST_GeogFromText('SRID=4326;LINESTRING(108.22 16.06,108.24 16.06)') AS line) spatial
			 RETURNING "id"`,
			[campsiteId, `Route ${Date.now()}`]
		)) as Array<{ id: string }>;
		routeIds.push(rows[0].id);
		return rows[0].id;
	}

	async function createAssessment(
		routeId: string,
		hostId: string,
		riskLevel: RiskLevel,
		rainfallMm = 0,
		windKph = 10
	): Promise<string> {
		const snapRows = (await dataSource.query(
			`INSERT INTO "weather_snapshots"
			 ("route_id", "status", "observed_at", "temperature_c", "rainfall_mm", "wind_kph", "humidity_percent",
			  "visibility_m", "thunderstorm", "raw_provider_payload", "fetched_by")
			 VALUES ($1, 'success', NOW(), 25.0, $2, $3, 80, 10000, $4, '{}'::jsonb, $5) RETURNING "id"`,
			[routeId, rainfallMm, windKph, riskLevel === RiskLevel.RED && rainfallMm > 50, hostId]
		)) as Array<{ id: string }>;

		const criteriaScores = {
			rainfall: {
				value: rainfallMm,
				level: riskLevel,
				weight: 0.3,
				score: riskLevel === RiskLevel.RED ? 2 : 0,
			},
			wind: {
				value: windKph,
				level: riskLevel,
				weight: 0.25,
				score: riskLevel === RiskLevel.RED ? 2 : 0,
			},
			temperature: { value: 25, level: RiskLevel.GREEN, weight: 0.15, score: 0 },
			visibility: { value: 10000, level: RiskLevel.GREEN, weight: 0.15, score: 0 },
			thunderstorm: { value: false, level: RiskLevel.GREEN, weight: 0.15, score: 0 },
		};

		const compositeScore =
			riskLevel === RiskLevel.RED ? 1.5 : riskLevel === RiskLevel.YELLOW ? 0.8 : 0.2;

		const assessRows = (await dataSource.query(
			`INSERT INTO "weather_risk_assessments"
			 ("route_id", "snapshot_id", "rule_version_id", "risk_level", "composite_score", "criteria_scores", "created_by")
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING "id"`,
			[
				routeId,
				snapRows[0].id,
				activeRuleId,
				riskLevel,
				compositeScore,
				JSON.stringify(criteriaScores),
				hostId,
			]
		)) as Array<{ id: string }>;

		return assessRows[0].id;
	}

	function checkEligibility(token: string | undefined, routeId: string) {
		const req = request(app.getHttpServer()).post(
			`/api/trekking-routes/${routeId}/check-registration-eligibility`
		);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("returns HTTP 200 and allowed = true when route weather risk is GREEN", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));
		await createAssessment(routeId, host.id, RiskLevel.GREEN, 0, 10);

		const response = await checkEligibility(camper.accessToken, routeId).expect(200);

		expect(response.body).toMatchObject({
			allowed: true,
			routeId,
			riskLevel: "green",
			compositeScore: 0.2,
			reasons: [],
		});
		expect(response.body.assessmentTime).toBeDefined();
	});

	it("returns HTTP 200 and allowed = true when route weather risk is YELLOW", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));
		await createAssessment(routeId, host.id, RiskLevel.YELLOW, 15, 45);

		const response = await checkEligibility(camper.accessToken, routeId).expect(200);

		expect(response.body).toMatchObject({
			allowed: true,
			routeId,
			riskLevel: "yellow",
			compositeScore: 0.8,
			reasons: [],
		});
	});

	it("returns HTTP 409 Conflict with failing criteria reasons and assessment time when route weather risk is RED (BR-071, BR-072, BR-073)", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));
		await createAssessment(routeId, host.id, RiskLevel.RED, 80, 85);

		// Record initial count of bookings in DB
		const initialBookings = (await dataSource.query('SELECT COUNT(*) FROM "bookings"')) as Array<{
			count: string;
		}>;

		const response = await checkEligibility(camper.accessToken, routeId).expect(409);

		expect(response.body).toMatchObject({
			statusCode: 409,
			error: "Conflict",
			message: "New registrations are blocked because route weather risk is RED",
			allowed: false,
			routeId,
			riskLevel: "red",
			compositeScore: 1.5,
		});

		expect(response.body.assessmentTime).toBeDefined();
		expect(response.body.reasons).toHaveLength(2);
		expect(response.body.reasons[0]).toMatchObject({
			criterion: "rainfall",
			level: "red",
			value: 80,
		});
		expect(response.body.reasons[1]).toMatchObject({
			criterion: "wind",
			level: "red",
			value: 85,
		});

		// Verify zero side effect: booking table count remains unchanged (BR-243)
		const finalBookings = (await dataSource.query('SELECT COUNT(*) FROM "bookings"')) as Array<{
			count: string;
		}>;
		expect(finalBookings[0].count).toBe(initialBookings[0].count);
	});

	it("returns HTTP 409 Conflict when attempting to check eligibility on a route with no calculated risk assessment", async () => {
		const host = await createAccount("host");
		const camper = await createAccount("camper");
		const routeId = await createRoute(await createCampsite(host.id));

		await checkEligibility(camper.accessToken, routeId).expect(409);
	});

	it("returns HTTP 404 for a route that does not exist", async () => {
		const camper = await createAccount("camper");

		await checkEligibility(camper.accessToken, "00000000-0000-0000-0000-000000000000").expect(404);
	});

	it("returns HTTP 401 when request is unauthenticated", async () => {
		const host = await createAccount("host");
		const routeId = await createRoute(await createCampsite(host.id));

		await checkEligibility(undefined, routeId).expect(401);
	});

	it("returns HTTP 403 when user account is suspended (BR-202)", async () => {
		const host = await createAccount("host");
		const suspendedCamper = await createAccount("camper", "suspended");
		const routeId = await createRoute(await createCampsite(host.id));

		await checkEligibility(suspendedCamper.accessToken, routeId).expect(403);
	});
});
