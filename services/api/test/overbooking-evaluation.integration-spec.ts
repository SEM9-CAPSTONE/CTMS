import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import {
	DEFAULT_CONFIG_VERSION,
	DEFAULT_DATASET_VERSION,
	DEFAULT_RULE_VERSION,
} from "../src/modules/overbooking-evaluation/overbooking-evaluation.constants";
import {
	OverbookingEvaluationGateName,
	OverbookingEvaluationScenarioType,
	OverbookingEvaluationStatus,
} from "../src/modules/overbooking-evaluation/overbooking-evaluation.enums";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

describe("Overbooking Evaluation (integration, real Postgres) - CTMS-095", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;

	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];
	const reportIds: string[] = [];

	let admin: Account;
	let host: Account;
	let camper: Account;
	let routeId: string;
	let tripId: string;

	beforeAll(async () => {
		jest.setTimeout(60_000);
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
		await createFixture();
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (reportIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "overbooking_evaluation_reports" WHERE "id" = ANY($1)',
					[reportIds]
				);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
					bookingIds,
				]);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id"::text FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query(
					'DELETE FROM "booking_members" WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query(
					'DELETE FROM "booking_items" WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, label: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`overbooking-eval-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Overbooking Eval ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(): Promise<string> {
		const id = randomUUID();
		routeIds.push(id);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'Overbooking Evaluation Route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				4000, 'moderate', 240, $3
			 )`,
			[id, host.id, TrekkingRouteStatus.ACTIVE]
		);
		return id;
	}

	async function createTrip(tripRouteId: string): Promise<string> {
		const id = randomUUID();
		const startsAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
		const endsAt = new Date(Date.now() + 22 * 24 * 60 * 60 * 1000);
		const bookingDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status", "cancellation_policy"
			 ) VALUES (
				$1, $2, $3, 'Overbooking Evaluation Trip', 'day_trip', 1, $4, $5,
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$6, 1, 10, 0, '200000.00', $7, '{"refundHours": 48}'::jsonb
			 )`,
			[id, host.id, tripRouteId, startsAt, endsAt, bookingDeadline, TripStatus.PUBLISHED]
		);
		tripIds.push(id);
		return id;
	}

	async function createFixture() {
		admin = await createAccount(UserRole.ADMIN, "admin");
		host = await createAccount(UserRole.HOST, "host");
		camper = await createAccount(UserRole.CAMPER, "camper");
		routeId = await createRoute();
		tripId = await createTrip(routeId);
	}

	describe("Authorization & Security", () => {
		it("rejects unauthenticated requests with 401", async () => {
			await request(app.getHttpServer())
				.post("/api/evaluations/overbooking/run")
				.send({})
				.expect(401);
		});

		it("rejects non-admin role with 403", async () => {
			await request(app.getHttpServer())
				.post("/api/evaluations/overbooking/run")
				.set("Authorization", `Bearer ${camper.accessToken}`)
				.send({})
				.expect(403);
		});
	});

	describe("POST /api/evaluations/overbooking/run (BR-276, BR-282, AC1-AC5)", () => {
		it("runs evaluation scenarios against trip capacity and passes ZERO_OVERBOOKING gate", async () => {
			const res = await request(app.getHttpServer())
				.post("/api/evaluations/overbooking/run")
				.set("Authorization", `Bearer ${admin.accessToken}`)
				.send({
					datasetVersion: DEFAULT_DATASET_VERSION,
					tripId,
					scenarios: [
						OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT,
						OverbookingEvaluationScenarioType.OVERSUBSCRIPTION_CONCURRENT,
					],
				})
				.expect(201);

			const body = res.body;
			reportIds.push(body.id);

			expect(body.id).toBeDefined();
			expect(body.datasetVersion).toBe(DEFAULT_DATASET_VERSION);
			expect(body.configVersion).toBe(DEFAULT_CONFIG_VERSION);
			expect(body.ruleVersion).toBe(DEFAULT_RULE_VERSION);
			expect(body.overallResult).toBe(OverbookingEvaluationStatus.PASSED);
			expect(body.evaluatorId).toBe(admin.id);

			// Gate verification (AC3)
			expect(body.gates).toBeDefined();
			const gate = body.gates[OverbookingEvaluationGateName.ZERO_OVERBOOKING];
			expect(gate).toBeDefined();
			expect(gate.passed).toBe(true);
			expect(gate.actual).toBe(0);
			expect(gate.threshold).toBe(0);

			// Operational metrics verification (AC2, AC4)
			expect(body.metrics).toBeDefined();
			expect(body.metrics.totalScenarios).toBe(2);
			expect(body.metrics.totalRequests).toBe(15); // 5 exact + 10 oversubscribed
			expect(body.metrics.successfulBookings).toBe(10); // 5 + 5
			expect(body.metrics.rejectedFullCapacity).toBe(5); // 0 + 5
			expect(body.metrics.overbookingCount).toBe(0);
			expect(body.metrics.avgLockLatencyMs).toBeGreaterThanOrEqual(0);
			expect(body.metrics.maxLockLatencyMs).toBeGreaterThanOrEqual(0);

			// Scenario breakdown (AC1, AC5)
			expect(body.scenarioResults).toHaveLength(2);
			for (const scenario of body.scenarioResults) {
				expect(scenario.passed).toBe(true);
				expect(scenario.overbookingViolations).toBe(0);
				expect(scenario.finalSeatsTaken).toBeLessThanOrEqual(scenario.tripCapacity);
			}
		});
	});

	describe("GET /api/evaluations/overbooking/latest, reports, :id", () => {
		it("retrieves the latest report and report history", async () => {
			const latestRes = await request(app.getHttpServer())
				.get("/api/evaluations/overbooking/latest")
				.set("Authorization", `Bearer ${admin.accessToken}`)
				.expect(200);

			expect(latestRes.body.id).toBeDefined();
			expect(latestRes.body.overallResult).toBe(OverbookingEvaluationStatus.PASSED);

			const historyRes = await request(app.getHttpServer())
				.get("/api/evaluations/overbooking/reports?limit=10")
				.set("Authorization", `Bearer ${admin.accessToken}`)
				.expect(200);

			expect(Array.isArray(historyRes.body)).toBe(true);
			expect(historyRes.body.length).toBeGreaterThan(0);

			const singleRes = await request(app.getHttpServer())
				.get(`/api/evaluations/overbooking/reports/${latestRes.body.id}`)
				.set("Authorization", `Bearer ${admin.accessToken}`)
				.expect(200);

			expect(singleRes.body.id).toBe(latestRes.body.id);
		});
	});
});
