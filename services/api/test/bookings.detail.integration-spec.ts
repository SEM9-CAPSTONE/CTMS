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
	email: string;
	accessToken: string;
}

interface Fixture {
	host: Account;
	owner: Account;
	participant: Account;
	otherCamper: Account;
	routeId: string;
	tripId: string;
	equipmentId: string;
}

describe("GET /api/bookings/:bookingId (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const equipmentIds: string[] = [];
	const bookingIds: string[] = [];

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
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
					bookingIds,
				]);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (equipmentIds.length > 0) {
				await dataSource.query('DELETE FROM "equipment_catalog_items" WHERE "id" = ANY($1)', [
					equipmentIds,
				]);
			}
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
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		const email = `booking-detail-${id}@example.com`;
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, email, await hash("S3curePass!", 10), role, UserStatus.ACTIVE, "Private Name"]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, email, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createFixture(): Promise<Fixture> {
		const host = await createAccount(UserRole.HOST);
		const owner = await createAccount(UserRole.CAMPER);
		const participant = await createAccount(UserRole.CAMPER);
		const otherCamper = await createAccount(UserRole.CAMPER);
		const routeId = randomUUID();
		const tripId = randomUUID();
		const equipmentId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		equipmentIds.push(equipmentId);

		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, 'Current Ridge Route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			)`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "cancellation_policy", "status"
			) VALUES (
				$1, $2, $3, 'Current Summit Trip', 'day_trip', 0,
				'2035-11-10T01:00:00Z', '2035-11-11T10:00:00Z',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-11-09T01:00:00Z', 1, 10, 2, '500000.00', $4, $5
			)`,
			[tripId, host.id, routeId, { currentPolicy: true }, TripStatus.PUBLISHED]
		);
		await dataSource.query(
			`INSERT INTO "equipment_catalog_items" (
				"id", "host_id", "name", "category", "quantity_total", "rental_price_per_day", "status"
			) VALUES ($1, $2, 'Current Trekking Tent', 'shelter', 5, '50000.00', 'active')`,
			[equipmentId, host.id]
		);
		return { host, owner, participant, otherCamper, routeId, tripId, equipmentId };
	}

	async function createBooking(
		fixture: Fixture,
		overrides: {
			status?: BookingStatus;
			paymentStatus?: "not_required" | "unpaid" | "paid";
			holdExpiresAt?: string | null;
		} = {}
	): Promise<string> {
		const id = randomUUID();
		bookingIds.push(id);
		const status = overrides.status ?? BookingStatus.PENDING_PAYMENT;
		const paymentStatus = overrides.paymentStatus ?? "unpaid";
		const holdExpiresAt =
			overrides.holdExpiresAt === undefined ? "2020-01-01T00:00:00.000Z" : overrides.holdExpiresAt;
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"hold_expires_at", "trip_starts_at_snapshot", "trip_ends_at_snapshot",
				"base_price", "total_amount", "cancellation_policy_snapshot"
			) VALUES (
				$1, $2, $3, 2, $4, $5, $6,
				'2035-10-01T01:00:00.000Z', '2035-10-02T10:00:00.000Z',
				'1500000.00', '1700000.00', $7
			)`,
			[
				id,
				fixture.tripId,
				fixture.owner.id,
				status,
				paymentStatus,
				holdExpiresAt,
				{ refundHours: 48 },
			]
		);
		return id;
	}

	function getDetails(token: string, bookingId: string) {
		return request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}`)
			.set("Authorization", `Bearer ${token}`);
	}

	it("returns the owner-only populated aggregate with string money and approved PII", async () => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status")
			 VALUES ($1, $2, $3, true, 'registered'), ($4, $2, $5, false, 'registered')`,
			[randomUUID(), bookingId, fixture.owner.id, randomUUID(), fixture.participant.id]
		);
		await dataSource.query(
			`INSERT INTO "booking_items" (
				"id", "booking_id", "item_type", "equipment_catalog_item_id", "quantity",
				"unit_price", "rental_days", "total_price"
			) VALUES ($1, $2, 'equipment', $3, 2, '50000.00', 2, '200000.00')`,
			[randomUUID(), bookingId, fixture.equipmentId]
		);

		const response = await getDetails(fixture.owner.accessToken, bookingId).expect(200);

		expect(response.body).toMatchObject({
			id: bookingId,
			tripId: fixture.tripId,
			userId: fixture.owner.id,
			status: "pending_payment",
			paymentStatus: "unpaid",
			basePrice: "1500000.00",
			totalAmount: "1700000.00",
			tripStartsAtSnapshot: "2035-10-01T01:00:00.000Z",
			tripEndsAtSnapshot: "2035-10-02T10:00:00.000Z",
			cancellationPolicySnapshot: { refundHours: 48 },
			tripPresentation: {
				id: fixture.tripId,
				currentTitle: "Current Summit Trip",
				routeId: fixture.routeId,
				currentRouteName: "Current Ridge Route",
			},
		});
		expect(response.body.members).toHaveLength(2);
		expect(response.body.members[0]).toMatchObject({
			userId: fixture.owner.id,
			email: fixture.owner.email,
			isPrimary: true,
		});
		expect(response.body.members[0]).not.toHaveProperty("fullName");
		expect(response.body.members[0]).not.toHaveProperty("phone");
		expect(response.body.equipmentItems).toEqual([
			expect.objectContaining({
				equipmentCatalogItemId: fixture.equipmentId,
				unitPrice: "50000.00",
				totalPrice: "200000.00",
				presentation: { currentName: "Current Trekking Tent" },
			}),
		]);
		expect(typeof response.body.basePrice).toBe("string");
		expect(typeof response.body.totalAmount).toBe("string");
		expect(typeof response.body.equipmentItems[0].unitPrice).toBe("string");
		expect(typeof response.body.equipmentItems[0].totalPrice).toBe("string");
	});

	it("returns 422 for malformed UUID, 404 for missing Booking, and 403 for a foreign Booking", async () => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture);

		await getDetails(fixture.owner.accessToken, "not-a-uuid").expect(422);
		await getDetails(fixture.owner.accessToken, randomUUID()).expect(404);
		await getDetails(fixture.otherCamper.accessToken, bookingId).expect(403);
	});

	it.each([
		BookingStatus.CONFIRMED,
		BookingStatus.CANCELLED,
		BookingStatus.EXPIRED,
		BookingStatus.COMPLETED,
	])("keeps %s Booking details readable", async (status) => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture, {
			status,
			paymentStatus: status === BookingStatus.CONFIRMED ? "paid" : "not_required",
			holdExpiresAt: null,
		});

		const response = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		expect(response.body.status).toBe(status);
		expect(response.body.cancellationPolicySnapshot).toEqual({ refundHours: 48 });
	});

	it("returns empty legacy sections and nullable optional values", async () => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture, {
			status: BookingStatus.CONFIRMED,
			paymentStatus: "not_required",
			holdExpiresAt: null,
		});
		await dataSource.query(
			'UPDATE "bookings" SET "cancellation_policy_snapshot" = NULL WHERE "id" = $1',
			[bookingId]
		);

		const response = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		expect(response.body).toMatchObject({
			holdExpiresAt: null,
			cancellationPolicySnapshot: null,
			members: [],
			equipmentItems: [],
		});
	});

	it("keeps historical schedule snapshots while current presentation changes or becomes unavailable", async () => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture);
		await dataSource.query(
			`UPDATE "trips" SET "title" = 'Renamed Current Trip',
			 "starts_at" = '2036-01-01T00:00:00Z', "ends_at" = '2036-01-02T00:00:00Z'
			 WHERE "id" = $1`,
			[fixture.tripId]
		);

		let response = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		expect(response.body.tripPresentation.currentTitle).toBe("Renamed Current Trip");
		expect(response.body.tripStartsAtSnapshot).toBe("2035-10-01T01:00:00.000Z");
		expect(response.body.tripEndsAtSnapshot).toBe("2035-10-02T10:00:00.000Z");

		await dataSource.query('UPDATE "trips" SET "title" = $1 WHERE "id" = $2', ["", fixture.tripId]);
		response = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		expect(response.body.tripPresentation).toBeNull();
		expect(response.body.tripStartsAtSnapshot).toBe("2035-10-01T01:00:00.000Z");
	});

	it("does not lazily expire or otherwise mutate repeated reads", async () => {
		const fixture = await createFixture();
		const bookingId = await createBooking(fixture);
		const before = await dataSource.query(
			`SELECT b."status", b."payment_status", t."seats_taken",
				(SELECT COUNT(*)::int FROM "booking_members" WHERE "booking_id" = b."id") AS "members",
				(SELECT COUNT(*)::int FROM "booking_items" WHERE "booking_id" = b."id") AS "items",
				(SELECT COUNT(*)::int FROM "audit_logs" WHERE "target_id" = b."id") AS "audits"
			 FROM "bookings" b JOIN "trips" t ON t."id" = b."trip_id" WHERE b."id" = $1`,
			[bookingId]
		);

		const first = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		const second = await getDetails(fixture.owner.accessToken, bookingId).expect(200);
		const after = await dataSource.query(
			`SELECT b."status", b."payment_status", t."seats_taken",
				(SELECT COUNT(*)::int FROM "booking_members" WHERE "booking_id" = b."id") AS "members",
				(SELECT COUNT(*)::int FROM "booking_items" WHERE "booking_id" = b."id") AS "items",
				(SELECT COUNT(*)::int FROM "audit_logs" WHERE "target_id" = b."id") AS "audits"
			 FROM "bookings" b JOIN "trips" t ON t."id" = b."trip_id" WHERE b."id" = $1`,
			[bookingId]
		);

		expect(second.body).toEqual(first.body);
		expect(first.body).toMatchObject({
			status: "pending_payment",
			paymentStatus: "unpaid",
			holdExpiresAt: "2020-01-01T00:00:00.000Z",
		});
		expect(after).toEqual(before);
	});
});
