import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface BookingFixture {
	camper: Account;
	tripId: string;
}

describe("POST /api/bookings (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const snapshotIds: string[] = [];
	const ruleIds: string[] = [];

	beforeAll(async () => {
		jest.setTimeout(60000);
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
	}, 60000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (tripIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (snapshotIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "weather_risk_assessments" WHERE "snapshot_id" = ANY($1)',
					[snapshotIds]
				);
				await dataSource.query('DELETE FROM "weather_snapshots" WHERE "id" = ANY($1)', [
					snapshotIds,
				]);
			}
			if (tripIds.length > 0)
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (ruleIds.length > 0)
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = ANY($1)', [ruleIds]);
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, `booking-${id}@example.com`, passwordHash, role, UserStatus.ACTIVE, `Booking ${role}`]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createFixture(
		options: {
			pricePerPerson?: string;
			capacityMax?: number;
			riskLevel?: "green" | "yellow" | "red";
		} = {}
	): Promise<BookingFixture> {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const routeId = randomUUID();
		const tripId = randomUUID();
		const snapshotId = randomUUID();
		const ruleId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		snapshotIds.push(snapshotId);
		ruleIds.push(ruleId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			)`,
			[routeId, host.id, `Booking route ${routeId}`, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "cancellation_policy", "status"
			) VALUES (
				$1, $2, $3, 'Booking integration Trip', 'day_trip', 0,
				'2035-10-10T01:00:00Z', '2035-10-10T10:00:00Z',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-10-09T01:00:00Z', 1, $4, 0, $5, $6, $7
			)`,
			[
				tripId,
				host.id,
				routeId,
				options.capacityMax ?? 5,
				options.pricePerPerson ?? "500000.00",
				{ refundHours: 48 },
				TripStatus.PUBLISHED,
			]
		);
		await dataSource.query(
			`INSERT INTO "weather_snapshots" ("id", "route_id", "status", "observed_at")
			 VALUES ($1, $2, 'success', now())`,
			[snapshotId, routeId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_rules" (
				"id", "rainfall_yellow_threshold", "rainfall_red_threshold",
				"wind_yellow_threshold", "wind_red_threshold", "temp_low_yellow", "temp_low_red",
				"temp_high_yellow", "temp_high_red", "visibility_yellow_threshold",
				"visibility_red_threshold", "thunderstorm_yellow", "thunderstorm_red",
				"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight",
				"thunderstorm_weight", "green_max_score", "yellow_max_score", "is_active"
			) VALUES (
				$1, 10, 50, 40, 70, 5, 0, 38, 42, 5000, 1000, true, true,
				0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, true
			)`,
			[ruleId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (
				"route_id", "snapshot_id", "rule_version_id", "risk_level",
				"composite_score", "criteria_scores", "created_by"
			) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				routeId,
				snapshotId,
				ruleId,
				options.riskLevel ?? "green",
				options.riskLevel === "red" ? 2 : 0,
				{
					rainfall: { value: 0, level: options.riskLevel ?? "green", weight: 0.3, score: 0 },
					wind: { value: 0, level: "green", weight: 0.2, score: 0 },
					temperature: { value: 20, level: "green", weight: 0.2, score: 0 },
					visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
					thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
				},
				camper.id,
			]
		);
		return { camper, tripId };
	}

	it("persists a paid Booking, exact snapshots, seats, and audit", async () => {
		const { camper, tripId } = await createFixture();
		const response = await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId, numPeople: 3 })
			.expect(201);

		expect(response.body).toMatchObject({
			tripId,
			userId: camper.id,
			numPeople: 3,
			status: "pending_payment",
			paymentStatus: "unpaid",
			basePrice: "1500000.00",
		});
		const rows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(rows[0].seats_taken).toBe(3);
		const audits = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1',
			[response.body.id]
		);
		expect(audits).toEqual([{ action: "booking.created" }]);

		await dataSource.query('UPDATE "trips" SET "seats_taken" = 0 WHERE "id" = $1', [tripId]);
		await dataSource.query("SELECT recompute_trip_seats_taken($1)", [tripId]);
		const reconciled = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(reconciled[0].seats_taken).toBe(3);
	});

	it("creates a free confirmed Booking without a hold", async () => {
		const { camper, tripId } = await createFixture({ pricePerPerson: "0.00" });
		const response = await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId, numPeople: 1 })
			.expect(201);
		expect(response.body).toMatchObject({
			status: "confirmed",
			paymentStatus: "not_required",
			holdExpiresAt: null,
			basePrice: "0.00",
		});
	});

	it("replays concurrent same-key requests as one authoritative Booking", async () => {
		const { camper, tripId } = await createFixture();
		const key = randomUUID();
		const createRequest = () =>
			request(app.getHttpServer())
				.post("/api/bookings")
				.set("Authorization", `Bearer ${camper.accessToken}`)
				.set("Idempotency-Key", key)
				.send({ tripId, numPeople: 2 });
		const [first, second] = await Promise.all([createRequest(), createRequest()]);

		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		expect(first.body.id).toBe(second.body.id);
		const rows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(rows[0].seats_taken).toBe(2);
		const bookings = await dataSource.query('SELECT "id" FROM "bookings" WHERE "trip_id" = $1', [
			tripId,
		]);
		const audits = await dataSource.query(
			'SELECT "id" FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[first.body.id, "booking.created"]
		);
		expect(bookings).toHaveLength(1);
		expect(audits).toHaveLength(1);
	});

	it("allows different users to reuse the same literal idempotency key", async () => {
		const fixture = await createFixture();
		const secondCamper = await createAccount(UserRole.CAMPER);
		const key = randomUUID();

		const first = await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${fixture.camper.accessToken}`)
			.set("Idempotency-Key", key)
			.send({ tripId: fixture.tripId, numPeople: 1 })
			.expect(201);
		const second = await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${secondCamper.accessToken}`)
			.set("Idempotency-Key", key)
			.send({ tripId: fixture.tripId, numPeople: 1 })
			.expect(201);

		expect(second.body.id).not.toBe(first.body.id);
		const rows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			fixture.tripId,
		]);
		expect(rows[0].seats_taken).toBe(2);
	});

	it("returns 409 for same key with a different payload without another reservation", async () => {
		const { camper, tripId } = await createFixture();
		const key = randomUUID();
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", key)
			.send({ tripId, numPeople: 1 })
			.expect(201);
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", key)
			.send({ tripId, numPeople: 2 })
			.expect(409);
		const rows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(rows[0].seats_taken).toBe(1);
	});

	it("serializes final-seat requests and never exceeds capacity", async () => {
		const fixture = await createFixture({ capacityMax: 1 });
		const secondCamper = await createAccount(UserRole.CAMPER);
		const createRequest = (camper: Account) =>
			request(app.getHttpServer())
				.post("/api/bookings")
				.set("Authorization", `Bearer ${camper.accessToken}`)
				.set("Idempotency-Key", randomUUID())
				.send({ tripId: fixture.tripId, numPeople: 1 });
		const responses = await Promise.all([
			createRequest(fixture.camper),
			createRequest(secondCamper),
		]);

		expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
		const rows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			fixture.tripId,
		]);
		expect(rows[0].seats_taken).toBe(1);
	});

	it("rejects Red Weather Risk without Booking, seats, or success audit", async () => {
		const { camper, tripId } = await createFixture({ riskLevel: "red" });
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId, numPeople: 1 })
			.expect(409);
		const bookings = await dataSource.query('SELECT "id" FROM "bookings" WHERE "trip_id" = $1', [
			tripId,
		]);
		const trips = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(bookings).toHaveLength(0);
		expect(trips[0].seats_taken).toBe(0);
	});

	it("rejects a missing Weather Risk without Booking or seats", async () => {
		const { camper, tripId } = await createFixture();
		await dataSource.query(
			'DELETE FROM "weather_risk_assessments" WHERE "route_id" = (SELECT "route_id" FROM "trips" WHERE "id" = $1)',
			[tripId]
		);

		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId, numPeople: 1 })
			.expect(409);

		const bookings = await dataSource.query('SELECT "id" FROM "bookings" WHERE "trip_id" = $1', [
			tripId,
		]);
		const trips = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			tripId,
		]);
		expect(bookings).toHaveLength(0);
		expect(trips[0].seats_taken).toBe(0);
	});

	it("rolls back Booking and seats when transactional audit persistence fails", async () => {
		const { camper, tripId } = await createFixture();
		await dataSource.query(`
			CREATE OR REPLACE FUNCTION reject_booking_created_audit()
			RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW.action = 'booking.created' THEN
					RAISE EXCEPTION 'forced booking audit failure';
				END IF;
				RETURN NEW;
			END $$
		`);
		await dataSource.query(`
			CREATE TRIGGER "TRG_test_reject_booking_created_audit"
			BEFORE INSERT ON "audit_logs"
			FOR EACH ROW EXECUTE FUNCTION reject_booking_created_audit()
		`);
		try {
			await request(app.getHttpServer())
				.post("/api/bookings")
				.set("Authorization", `Bearer ${camper.accessToken}`)
				.set("Idempotency-Key", randomUUID())
				.send({ tripId, numPeople: 1 })
				.expect(500);
			const bookings = await dataSource.query('SELECT "id" FROM "bookings" WHERE "trip_id" = $1', [
				tripId,
			]);
			const trips = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
				tripId,
			]);
			expect(bookings).toHaveLength(0);
			expect(trips[0].seats_taken).toBe(0);
		} finally {
			await dataSource.query(
				'DROP TRIGGER IF EXISTS "TRG_test_reject_booking_created_audit" ON "audit_logs"'
			);
			await dataSource.query("DROP FUNCTION IF EXISTS reject_booking_created_audit()");
		}
	});

	it("requires a Camper, a valid idempotency key, and only approved body fields", async () => {
		const fixture = await createFixture();
		const host = await createAccount(UserRole.HOST);
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId: fixture.tripId, numPeople: 1 })
			.expect(403);
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${fixture.camper.accessToken}`)
			.send({ tripId: fixture.tripId, numPeople: 1 })
			.expect(422);
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${fixture.camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId: fixture.tripId, numPeople: 1, basePrice: 0 })
			.expect(422);
	});

	it("keeps legacy Booking fields nullable and readable through the health-profile relationship", async () => {
		const { camper, tripId } = await createFixture();
		const legacyBookingId = randomUUID();
		await dataSource.query(
			'INSERT INTO "bookings" ("id", "trip_id", "user_id") VALUES ($1, $2, $3)',
			[legacyBookingId, tripId, camper.id]
		);

		const rows = await dataSource.query(
			`SELECT b."id", b."num_people", b."status", b."payment_status"
			 FROM "users" u
			 JOIN "bookings" b ON b."user_id" = u."id"
			 WHERE u."id" = $1 AND b."id" = $2`,
			[camper.id, legacyBookingId]
		);

		expect(rows).toEqual([
			{
				id: legacyBookingId,
				num_people: null,
				status: null,
				payment_status: null,
			},
		]);
	});
});
