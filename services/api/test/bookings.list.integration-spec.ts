import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

describe("GET /api/bookings (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

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
	}, 60000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (bookingIds.length > 0)
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			if (tripIds.length > 0)
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	}, 60000);

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, 'Booking List User')`,
			[id, `booking-list-${id}@example.com`, await hash("S3curePass!", 10), role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(hostId: string): Promise<{ routeId: string; tripId: string }> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, 'Booking List Route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			)`,
			[routeId, hostId, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			) VALUES (
				$1, $2, $3, 'Booking List Trip', 'day_trip', 0,
				'2035-11-10T01:00:00Z', '2035-11-11T10:00:00Z',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-11-09T01:00:00Z', 1, 10, 2, '500000.00', $4
			)`,
			[tripId, hostId, routeId, TripStatus.PUBLISHED]
		);
		return { routeId, tripId };
	}

	async function createBooking(
		tripId: string,
		ownerId: string,
		status: BookingStatus,
		createdAt: string
	): Promise<string> {
		const id = randomUUID();
		bookingIds.push(id);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"hold_expires_at", "trip_starts_at_snapshot", "trip_ends_at_snapshot",
				"base_price", "total_amount", "created_at"
			) VALUES (
				$1, $2, $3, 2, $4, $5, '2020-01-01T00:00:00Z',
				'2035-10-01T01:00:00Z', '2035-10-02T10:00:00Z',
				'1500000.00', '1700000.00', $6
			)`,
			[
				id,
				tripId,
				ownerId,
				status,
				status === BookingStatus.PENDING_PAYMENT ? "unpaid" : "paid",
				createdAt,
			]
		);
		return id;
	}

	function list(token?: string) {
		const call = request(app.getHttpServer()).get("/api/bookings");
		return token ? call.set("Authorization", `Bearer ${token}`) : call;
	}

	it("returns only the owner rows, newest first, including terminal states and no nested PII", async () => {
		const host = await createAccount(UserRole.HOST);
		const owner = await createAccount(UserRole.CAMPER);
		const other = await createAccount(UserRole.CAMPER);
		const { routeId, tripId } = await createTrip(host.id);
		const olderId = await createBooking(
			tripId,
			owner.id,
			BookingStatus.CONFIRMED,
			"2030-01-01T00:00:00Z"
		);
		const newerId = await createBooking(
			tripId,
			owner.id,
			BookingStatus.CANCELLED,
			"2030-01-02T00:00:00Z"
		);
		const foreignId = await createBooking(
			tripId,
			other.id,
			BookingStatus.COMPLETED,
			"2030-01-03T00:00:00Z"
		);

		const response = await list(owner.accessToken).expect(200);
		expect(response.body.map((booking: { id: string }) => booking.id)).toEqual([newerId, olderId]);
		expect(response.body.map((booking: { id: string }) => booking.id)).not.toContain(foreignId);
		expect(response.body[0]).toMatchObject({
			status: "cancelled",
			totalAmount: "1700000.00",
			tripPresentation: {
				id: tripId,
				currentTitle: "Booking List Trip",
				routeId,
				currentRouteName: "Booking List Route",
			},
		});
		expect(typeof response.body[0].totalAmount).toBe("string");
		expect(response.body[0]).not.toHaveProperty("userId");
		expect(response.body[0]).not.toHaveProperty("members");
		expect(response.body[0]).not.toHaveProperty("equipmentItems");
		expect(response.body[0]).not.toHaveProperty("idempotencyKey");
	});

	it("returns an empty list for a Camper without Bookings", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await expect(list(camper.accessToken).expect(200)).resolves.toMatchObject({ body: [] });
	});

	it("supports nullable legacy fields and missing current presentation", async () => {
		const host = await createAccount(UserRole.HOST);
		const owner = await createAccount(UserRole.CAMPER);
		const { tripId } = await createTrip(host.id);
		const bookingId = await createBooking(
			tripId,
			owner.id,
			BookingStatus.EXPIRED,
			"2030-02-01T00:00:00Z"
		);
		await dataSource.query(
			`UPDATE "bookings" SET "num_people" = NULL, "status" = NULL,
			 "payment_status" = NULL, "hold_expires_at" = NULL,
			 "trip_starts_at_snapshot" = NULL, "trip_ends_at_snapshot" = NULL,
			 "total_amount" = NULL WHERE "id" = $1`,
			[bookingId]
		);
		await dataSource.query('UPDATE "trips" SET "title" = $1 WHERE "id" = $2', ["", tripId]);

		const response = await list(owner.accessToken).expect(200);
		expect(response.body[0]).toMatchObject({
			id: bookingId,
			numPeople: null,
			status: null,
			paymentStatus: null,
			holdExpiresAt: null,
			tripStartsAtSnapshot: null,
			tripEndsAtSnapshot: null,
			totalAmount: null,
			tripPresentation: null,
		});
	});

	it("does not lazily expire or write during repeated reads", async () => {
		const host = await createAccount(UserRole.HOST);
		const owner = await createAccount(UserRole.CAMPER);
		const { tripId } = await createTrip(host.id);
		const bookingId = await createBooking(
			tripId,
			owner.id,
			BookingStatus.PENDING_PAYMENT,
			"2030-03-01T00:00:00Z"
		);
		const before = await dataSource.query(
			`SELECT b."status", b."payment_status", b."hold_expires_at", t."seats_taken",
			 (SELECT COUNT(*)::int FROM "audit_logs" WHERE "target_id" = b."id") AS "audits"
			 FROM "bookings" b JOIN "trips" t ON t."id" = b."trip_id" WHERE b."id" = $1`,
			[bookingId]
		);

		await list(owner.accessToken).expect(200);
		await list(owner.accessToken).expect(200);
		const after = await dataSource.query(
			`SELECT b."status", b."payment_status", b."hold_expires_at", t."seats_taken",
			 (SELECT COUNT(*)::int FROM "audit_logs" WHERE "target_id" = b."id") AS "audits"
			 FROM "bookings" b JOIN "trips" t ON t."id" = b."trip_id" WHERE b."id" = $1`,
			[bookingId]
		);
		expect(after).toEqual(before);
	});

	it("rejects unauthenticated and non-Camper callers", async () => {
		const host = await createAccount(UserRole.HOST);
		await list().expect(401);
		await list(host.accessToken).expect(403);
	});
});
