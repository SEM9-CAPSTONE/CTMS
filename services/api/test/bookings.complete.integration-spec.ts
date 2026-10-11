import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import {
	BookingPaymentStatus,
	BookingStatus,
} from "../src/modules/profiles/entities/booking.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

describe("POST /bookings/:bookingId/complete (integration)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

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
	});

	afterAll(async () => {
		if (bookingIds.length > 0) {
			await dataSource.query(`DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)`, [bookingIds]);
			await dataSource.query(`DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)`, [
				bookingIds,
			]);
			await dataSource.query(`DELETE FROM "bookings" WHERE "id" = ANY($1)`, [bookingIds]);
		}
		if (tripIds.length > 0) {
			await dataSource.query(`DELETE FROM "trip_waypoints" WHERE "trip_id" = ANY($1)`, [tripIds]);
			await dataSource.query(`DELETE FROM "trips" WHERE "id" = ANY($1)`, [tripIds]);
		}
		if (routeIds.length > 0) {
			await dataSource.query(`DELETE FROM "trekking_routes" WHERE "id" = ANY($1)`, [routeIds]);
		}
		if (userIds.length > 0) {
			await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1)`, [userIds]);
			await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [userIds]);
		}
		await app.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		userIds.push(id);
		const email = `complete-test-${id.slice(0, 8)}@example.com`;
		const passwordHash = await hash("TestPass123!", 10);
		await dataSource.query(
			`INSERT INTO "users" (id, email, phone, password_hash, role, status)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				email,
				`09${Math.floor(Math.random() * 90000000 + 10000000)}`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
			]
		);
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			[id, role]
		);
		const accessToken = jwtService.sign({
			sub: id,
			userId: id,
			roles: [role],
			status: UserStatus.ACTIVE,
		});
		return { id, accessToken };
	}

	async function createTrip(hostId: string, status: TripStatus): Promise<string> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			 )`,
			[routeId, hostId, `Route ${routeId.slice(0, 6)}`, TrekkingRouteStatus.ACTIVE]
		);

		const tripId = randomUUID();
		tripIds.push(tripId);
		const meetingPoint = { type: "Point", coordinates: [108.2, 16.0] };
		await dataSource.query(
			`INSERT INTO "trips" (
				id, host_id, route_id, title, description, trip_type, duration_nights,
				starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max,
				price_per_person, status
			 ) VALUES (
				$1, $2, $3, 'Test Trip', 'Desc', 'day_trip', 0,
				now() - interval '2 days', now() - interval '1 day',
				ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography,
				now() - interval '3 days', 1, 10, '500000.00', $5
			 )`,
			[tripId, hostId, routeId, JSON.stringify(meetingPoint), status]
		);
		return tripId;
	}

	async function createBooking(
		tripId: string,
		camperId: string,
		bookingStatus: BookingStatus,
		memberStatus: BookingMemberStatus
	): Promise<string> {
		const bookingId = randomUUID();
		bookingIds.push(bookingId);
		await dataSource.query(
			`INSERT INTO "bookings" (
				id, trip_id, user_id, num_people, status, payment_status,
				base_price, total_amount
			 ) VALUES ($1, $2, $3, 1, $4, $5, '500000.00', '500000.00')`,
			[bookingId, tripId, camperId, bookingStatus, BookingPaymentStatus.PAID]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				id, booking_id, user_id, is_primary, member_status
			 ) VALUES ($1, $2, $3, true, $4)`,
			[randomUUID(), bookingId, camperId, memberStatus]
		);
		return bookingId;
	}

	it("returns 401 Unauthorized without authentication token", async () => {
		const fakeId = randomUUID();
		await request(app.getHttpServer()).post(`/api/bookings/${fakeId}/complete`).expect(401);
	});

	it("returns 403 Forbidden when caller is a Camper", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host.id, TripStatus.COMPLETED);
		const bookingId = await createBooking(
			tripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.JOINED
		);

		await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/complete`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(403);
	});

	it("returns 409 Conflict when Trip is not in completed status (BR-115)", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host.id, TripStatus.PUBLISHED);
		const bookingId = await createBooking(
			tripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.JOINED
		);

		const res = await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/complete`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(409);

		expect(res.body.message).toContain("completed status");
	});

	it("returns 409 Conflict when Booking members are still REGISTERED (not checked in)", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host.id, TripStatus.COMPLETED);
		const bookingId = await createBooking(
			tripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.REGISTERED
		);

		const res = await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/complete`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(409);

		expect(res.body.message).toContain("member(s) have not been checked in");
	});

	it("completes booking successfully and returns server completed_at idempotently", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host.id, TripStatus.COMPLETED);
		const bookingId = await createBooking(
			tripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.JOINED
		);

		const res = await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/complete`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);

		expect(res.body.id).toBe(bookingId);
		expect(res.body.status).toBe(BookingStatus.COMPLETED);
		expect(res.body.completedAt).toBeDefined();

		// Idempotency: repeated call returns 200 with same completedAt
		const repeatRes = await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/complete`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);

		expect(repeatRes.body.completedAt).toBe(res.body.completedAt);
	});
});
