import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import {
	datasetHash,
	findManualAssessmentDataset,
} from "../src/modules/weather-risk-evaluation/datasets";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

describe("Compare Weather Risk results with manual assessment (CTMS-099, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const ruleIds: string[] = [];
	let admin: Account;
	let host: Account;

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
		await assertSafeTestDatabase(dataSource);
		admin = await createAccount(UserRole.ADMIN);
		host = await createAccount(UserRole.HOST);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				'DELETE FROM "weather_risk_evaluation_reports" WHERE "evaluator_id" = ANY($1) OR "rule_id" = ANY($2)',
				[userIds, ruleIds]
			);
			await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = ANY($1)', [ruleIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Weather evaluation user')`,
			[id, `weather-evaluation-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	/** A rule version for the test; only made active when the database has no active rule. */
	async function createRule(
		rainfallRed: number,
		active = false
	): Promise<{ id: string; version: number }> {
		const id = randomUUID();
		const [row] = (await dataSource.query(
			`INSERT INTO "weather_risk_rules" (
				"id", "rainfall_yellow_threshold", "rainfall_red_threshold",
				"wind_yellow_threshold", "wind_red_threshold", "temp_low_yellow", "temp_low_red",
				"temp_high_yellow", "temp_high_red", "visibility_yellow_threshold",
				"visibility_red_threshold", "thunderstorm_yellow", "thunderstorm_red",
				"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight",
				"thunderstorm_weight", "green_max_score", "yellow_max_score", "is_active"
			) VALUES (
				$1, 10, $2, 40, 70, 5, 0, 38, 42, 5000, 1000, true, true,
				0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, $3
			) RETURNING "version"`,
			[id, rainfallRed, active]
		)) as Array<{ version: number }>;
		ruleIds.push(id);
		return { id, version: row.version };
	}

	const api = () => request(app.getHttpServer());
	const asAdmin = (call: request.Test) => call.set("Authorization", `Bearer ${admin.accessToken}`);

	it("runs on the newest dataset with the active rule and stores dataset, rule, gates and conclusion", async () => {
		const activeRules = (await dataSource.query(
			`SELECT 1 FROM "weather_risk_rules" WHERE "is_active" = true LIMIT 1`
		)) as unknown[];
		if (activeRules.length === 0) {
			// Without an active rule there is nothing to evaluate.
			await asAdmin(api().post("/api/evaluations/weather-risk/run")).send({}).expect(409);
			await createRule(50, true);
		}
		const [active] = (await dataSource.query(
			`SELECT "id", "version", "rainfall_red_threshold" AS "rainfallRed" FROM "weather_risk_rules"
			 WHERE "is_active" = true ORDER BY "version" DESC LIMIT 1`
		)) as Array<{ id: string; version: number; rainfallRed: number }>;
		const dataset = findManualAssessmentDataset();
		if (!dataset) throw new Error("No manual-assessment dataset");

		const response = await asAdmin(api().post("/api/evaluations/weather-risk/run"))
			.send({})
			.expect(201);
		expect(response.body).toMatchObject({
			datasetVersion: dataset.version,
			datasetHash: datasetHash(dataset),
			datasetStatus: "draft",
			ruleId: active.id,
			ruleVersion: active.version,
			evaluatorId: admin.id,
			// A draft dataset can never support a release.
			overallResult: "INVALID",
		});
		expect(response.body.ruleSnapshot.rainfallRedThreshold).toBe(active.rainfallRed);
		for (const gate of ["OVERALL_AGREEMENT", "MISSED_RED_RATE", "FALSE_RED_RATE"]) {
			expect(response.body.gates[gate]).toEqual(
				expect.objectContaining({
					gateName: gate,
					threshold: expect.any(Number),
					passed: expect.any(Boolean),
				})
			);
		}
		expect(response.body.metrics.byLevel).toEqual(
			expect.objectContaining({
				green: expect.objectContaining({ cases: 20 }),
				yellow: expect.objectContaining({ cases: 20 }),
				red: expect.objectContaining({ cases: 20 }),
			})
		);
		expect(response.body.metrics.boundaryCases.cases).toBe(18);
		expect(response.body.caseResults).toHaveLength(dataset.cases.length);
		expect(response.body.failureReasons[0]).toContain("is a draft");

		const [stored] = (await dataSource.query(
			`SELECT "dataset_version" AS "datasetVersion", "dataset_hash" AS "datasetHash", "rule_version" AS "ruleVersion",
			        "overall_result" AS "overallResult", "config_version" AS "configVersion"
			 FROM "weather_risk_evaluation_reports" WHERE "id" = $1`,
			[response.body.id]
		)) as Array<Record<string, unknown>>;
		expect(stored).toMatchObject({
			datasetVersion: dataset.version,
			datasetHash: datasetHash(dataset),
			ruleVersion: active.version,
			overallResult: "INVALID",
			configVersion: "v3-weather-risk-evaluation-1",
		});

		const byId = await asAdmin(
			api().get(`/api/evaluations/weather-risk/reports/${response.body.id}`)
		).expect(200);
		expect(byId.body.id).toBe(response.body.id);
	});

	it("evaluates another rule version as a separate context without touching the active rule", async () => {
		const strict = await createRule(20);
		const response = await asAdmin(api().post("/api/evaluations/weather-risk/run"))
			.send({ ruleVersion: strict.version })
			.expect(201);
		expect(response.body).toMatchObject({ ruleId: strict.id, ruleVersion: strict.version });
		expect(response.body.ruleSnapshot.rainfallRedThreshold).toBe(20);
		const [{ isActive }] = (await dataSource.query(
			`SELECT "is_active" AS "isActive" FROM "weather_risk_rules" WHERE "id" = $1`,
			[strict.id]
		)) as Array<{ isActive: boolean }>;
		expect(isActive).toBe(false);

		const history = await asAdmin(
			api().get("/api/evaluations/weather-risk/reports?limit=5")
		).expect(200);
		expect(history.body[0].id).toBe(response.body.id);
		const latest = await asAdmin(api().get("/api/evaluations/weather-risk/latest")).expect(200);
		expect(latest.body.id).toBe(response.body.id);
	});

	it("lists the datasets and rejects bad input, unknown versions and non-Admins", async () => {
		const datasets = await asAdmin(api().get("/api/evaluations/weather-risk/datasets")).expect(200);
		expect(datasets.body[0]).toMatchObject({ totalCases: 60, boundaryCases: 18, status: "draft" });

		await asAdmin(api().post("/api/evaluations/weather-risk/run"))
			.send({ datasetVersion: "missing-version" })
			.expect(404);
		await asAdmin(api().post("/api/evaluations/weather-risk/run"))
			.send({ ruleVersion: 999999 })
			.expect(404);
		const badBody = await asAdmin(api().post("/api/evaluations/weather-risk/run")).send({
			ruleVersion: "x",
		});
		expect([400, 422]).toContain(badBody.status);
		await asAdmin(api().get("/api/evaluations/weather-risk/reports/not-a-uuid")).expect(422);
		await asAdmin(api().get(`/api/evaluations/weather-risk/reports/${randomUUID()}`)).expect(404);

		await api()
			.post("/api/evaluations/weather-risk/run")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({})
			.expect(403);
		await api().get("/api/evaluations/weather-risk/latest").expect(401);
	});
});
