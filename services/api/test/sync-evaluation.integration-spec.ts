import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import {
	DEFAULT_CONFIG_VERSION,
	DEFAULT_RULE_VERSION,
} from "../src/modules/sync-evaluation/sync-evaluation.constants";
import {
	SyncEvaluationGateName,
	SyncEvaluationStatus,
} from "../src/modules/sync-evaluation/sync-evaluation.enums";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;

describe("Buffer and Synchronization Evaluation (integration, real Postgres) - CTMS-097", () => {
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
	let tripStart: Date;

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
				await dataSource.query('DELETE FROM "sync_evaluation_reports" WHERE "id" = ANY($1)', [
					reportIds,
				]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "safety_events" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "gps_logs" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
					bookingIds,
				]);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
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
				`eval-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Eval ${label}`,
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
				$1, $2, 'Sync Evaluation Route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			 )`,
			[id, host.id, TrekkingRouteStatus.ACTIVE]
		);
		return id;
	}

	async function createTrip(tripRouteId: string): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'Sync Evaluation Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 1, 0, $5
			 )`,
			[id, host.id, tripRouteId, tripStart, TripStatus.ONGOING]
		);
		tripIds.push(id);
		return id;
	}

	async function addJoinedCamper(targetTripId: string, camperId: string) {
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount"
			 ) VALUES ($1, $2, $3, 1, $4, 'not_required', now(), now() + interval '8 hours', 0, 0)`,
			[bookingId, targetTripId, camperId, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at", "status_updated_by"
			 ) VALUES ($1, $2, $3, true, $4, $5, $6)`,
			[
				randomUUID(),
				bookingId,
				camperId,
				BookingMemberStatus.JOINED,
				new Date(tripStart.getTime() - HOUR_MS / 2),
				host.id,
			]
		);
		bookingIds.push(bookingId);
	}

	async function createFixture(): Promise<void> {
		tripStart = new Date(Date.now() - 2 * HOUR_MS);
		admin = await createAccount(UserRole.ADMIN, "admin");
		host = await createAccount(UserRole.HOST, "host");
		camper = await createAccount(UserRole.CAMPER, "camper");

		routeId = await createRoute();
		tripId = await createTrip(routeId);
		await addJoinedCamper(tripId, camper.id);
	}

	it("POST /api/evaluations/sync/run - executes full evaluation, enforces release gates, and stores report (PB AC-1..7, BR-278, BR-436, BR-282)", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/evaluations/sync/run")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({
				datasetVersion: "v3.0.0-offline-sync-integration-test",
				tripId,
			})
			.expect(201);

		const report = response.body;
		reportIds.push(report.id);

		expect(report.id).toBeDefined();
		expect(report.datasetVersion).toBe("v3.0.0-offline-sync-integration-test");
		expect(report.configVersion).toBe(DEFAULT_CONFIG_VERSION);
		expect(report.ruleVersion).toBe(DEFAULT_RULE_VERSION);
		expect(report.overallResult).toBe(SyncEvaluationStatus.PASSED);

		// Release Gate 1: 100% valid records accepted (BR-278, BR-436)
		const validGate = report.gates[SyncEvaluationGateName.VALID_RECORD_ACCEPTANCE];
		expect(validGate.passed).toBe(true);
		expect(validGate.actual).toBe(1.0);

		// Release Gate 2: 0 safety events lost (BR-278, BR-436)
		const safetyGate = report.gates[SyncEvaluationGateName.SAFETY_EVENT_LOSS];
		expect(safetyGate.passed).toBe(true);
		expect(safetyGate.actual).toBe(0);

		// Release Gate 3: 0 authoritative duplicate records created (BR-278, BR-436)
		const duplicateGate = report.gates[SyncEvaluationGateName.AUTHORITATIVE_DUPLICATE];
		expect(duplicateGate.passed).toBe(true);
		expect(duplicateGate.actual).toBe(0);

		// Observational Metrics (BR-282)
		expect(report.metrics.retryCount).toBeGreaterThanOrEqual(1);
		expect(report.metrics.avgBatchDelayMs).toBeGreaterThanOrEqual(0);
		expect(report.metrics.errorsBreakdown.ROUTE_VERSION_MISMATCH).toBe(1);

		// 6 scenarios executed
		expect(report.scenarioResults).toHaveLength(6);

		// Verify database persistence
		const dbRows = await dataSource.query(
			'SELECT * FROM "sync_evaluation_reports" WHERE "id" = $1',
			[report.id]
		);
		expect(dbRows).toHaveLength(1);
		expect(dbRows[0].overall_result).toBe("PASSED");
	});

	it("GET /api/evaluations/sync/latest - retrieves latest persisted evaluation report", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/evaluations/sync/latest")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(response.body.id).toBe(reportIds[0]);
		expect(response.body.overallResult).toBe("PASSED");
	});

	it("GET /api/evaluations/sync/reports - lists evaluation report history", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/evaluations/sync/reports?limit=5")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(Array.isArray(response.body)).toBe(true);
		expect(response.body.some((r: { id: string }) => r.id === reportIds[0])).toBe(true);
	});

	it("GET /api/evaluations/sync/reports/:id - retrieves report by ID", async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/evaluations/sync/reports/${reportIds[0]}`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(response.body.id).toBe(reportIds[0]);
	});

	it("rejects non-admin users with 403 Forbidden", async () => {
		await request(app.getHttpServer())
			.post("/api/evaluations/sync/run")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({})
			.expect(403);
	});
});
