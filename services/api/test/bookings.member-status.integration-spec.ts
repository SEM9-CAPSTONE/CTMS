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
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface Fixture {
	host: Account;
	porter: Account;
	owner: Account;
	tripId: string;
	bookingId: string;
	memberId: string;
}

describe("PATCH nested Booking member status (integration, real Postgres)", () => {
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
		await dataSource.query(
			`DELETE FROM "audit_logs"
			 WHERE "actor_id" IN (
				SELECT "id" FROM "users" WHERE "email" LIKE 'member-status-%@example.com'
			)`
		);
		await dataSource.query(
			`DELETE FROM "user_roles"
			 WHERE "user_id" IN (
				SELECT "id" FROM "users" WHERE "email" LIKE 'member-status-%@example.com'
			)`
		);
		await dataSource.query(`DELETE FROM "users" WHERE "email" LIKE 'member-status-%@example.com'`);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id" FROM "booking_members" WHERE "booking_id" = ANY($1))',
					[bookingIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, extraRoles: UserRole[] = []): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`member-status-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Member status ${id}`,
			]
		);
		for (const grantedRole of [role, ...extraRoles]) {
			await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
				id,
				grantedRole,
			]);
		}
		userIds.push(id);
		const roles = [role, ...extraRoles];
		return { id, accessToken: jwtService.sign({ sub: id, roles }) };
	}

	async function createFixture(
		options: {
			startsAt?: Date;
			tripStatus?: TripStatus;
			bookingStatus?: BookingStatus;
			porterStatus?: TripPorterStatus;
			hostExtraRoles?: UserRole[];
		} = {}
	): Promise<Fixture> {
		const host = await createAccount(UserRole.HOST, options.hostExtraRoles);
		const porter = await createAccount(UserRole.PORTER);
		const owner = await createAccount(UserRole.CAMPER);
		const routeId = randomUUID();
		const tripId = randomUUID();
		const bookingId = randomUUID();
		const memberId = randomUUID();
		const startsAt = options.startsAt ?? new Date(Date.now() + 60 * 60 * 1000);
		routeIds.push(routeId);
		tripIds.push(tripId);
		bookingIds.push(bookingId);

		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			)`,
			[routeId, host.id, `Member-status route ${routeId}`, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			) VALUES (
				$1, $2, $3, 'Member status integration Trip', 'day_trip', 0, $4,
				$4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 10, 1, 100000, $5
			)`,
			[tripId, host.id, routeId, startsAt, options.tripStatus ?? TripStatus.PUBLISHED]
		);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3)`,
			[tripId, porter.id, options.porterStatus ?? TripPorterStatus.ASSIGNED]
		);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount"
			) VALUES ($1, $2, $3, 1, $4, 'paid', $5, $5::timestamptz + interval '8 hours', 100000, 100000)`,
			[bookingId, tripId, owner.id, options.bookingStatus ?? BookingStatus.CONFIRMED, startsAt]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status")
			 VALUES ($1, $2, $3, true, 'registered')`,
			[memberId, bookingId, owner.id]
		);
		return { host, porter, owner, tripId, bookingId, memberId };
	}

	function updateRequest(fixture: Fixture, actor: Account, status: BookingMemberStatus) {
		return request(app.getHttpServer())
			.patch(
				`/api/trips/${fixture.tripId}/bookings/${fixture.bookingId}/members/${fixture.memberId}/status`
			)
			.set("Authorization", `Bearer ${actor.accessToken}`)
			.send({ status });
	}

	it("allows the owning Host to join a member and preserves Booking/capacity/payment", async () => {
		const fixture = await createFixture();
		const response = await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(
			200
		);
		expect(response.body).toEqual(
			expect.objectContaining({
				id: fixture.memberId,
				bookingId: fixture.bookingId,
				memberStatus: BookingMemberStatus.JOINED,
				statusUpdatedBy: fixture.host.id,
			})
		);
		expect(response.body.checkedInAt).toBeTruthy();

		const rows = await dataSource.query(
			`SELECT b."status", b."payment_status" AS "paymentStatus", t."seats_taken" AS "seatsTaken"
			 FROM "bookings" b JOIN "trips" t ON t."id" = b."trip_id" WHERE b."id" = $1`,
			[fixture.bookingId]
		);
		expect(rows[0]).toEqual({
			status: BookingStatus.CONFIRMED,
			paymentStatus: "paid",
			seatsTaken: 1,
		});
	});

	it("allows only an assigned Porter and rejects pending reconfirmation", async () => {
		const assigned = await createFixture();
		await updateRequest(assigned, assigned.porter, BookingMemberStatus.JOINED).expect(200);
		const pending = await createFixture({ porterStatus: TripPorterStatus.PENDING_RECONFIRMATION });
		await updateRequest(pending, pending.porter, BookingMemberStatus.JOINED).expect(403);
	});

	it("marks no-show only after Trip start and replays without replacing timestamp or audit", async () => {
		const fixture = await createFixture({ startsAt: new Date(Date.now() - 60 * 60 * 1000) });
		const first = await updateRequest(fixture, fixture.host, BookingMemberStatus.NO_SHOW).expect(
			200
		);
		const replay = await updateRequest(fixture, fixture.host, BookingMemberStatus.NO_SHOW).expect(
			200
		);
		expect(replay.body.noShowAt).toBe(first.body.noShowAt);
		expect(replay.body.statusUpdatedBy).toBe(first.body.statusUpdatedBy);
		const audits = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1',
			[fixture.memberId]
		);
		expect(audits).toEqual([{ action: "booking_member.no_show" }]);
	});

	it("replays joined after the Trip start without timing re-evaluation", async () => {
		const fixture = await createFixture();
		const first = await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(
			200
		);
		await dataSource.query(
			'UPDATE "trips" SET "starts_at" = now() - interval \'1 hour\' WHERE "id" = $1',
			[fixture.tripId]
		);
		const replay = await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(
			200
		);
		expect(replay.body.checkedInAt).toBe(first.body.checkedInAt);
		const audits = await dataSource.query('SELECT 1 FROM "audit_logs" WHERE "target_id" = $1', [
			fixture.memberId,
		]);
		expect(audits).toHaveLength(1);
	});

	it("uses nested 404s and rejects an unrelated Host before nested disclosure", async () => {
		const fixture = await createFixture();
		const other = await createFixture();
		await request(app.getHttpServer())
			.patch(
				`/api/trips/${fixture.tripId}/bookings/${other.bookingId}/members/${fixture.memberId}/status`
			)
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.send({ status: BookingMemberStatus.JOINED })
			.expect(404);
		await updateRequest(fixture, other.host, BookingMemberStatus.JOINED).expect(403);
		await request(app.getHttpServer())
			.patch(
				`/api/trips/${fixture.tripId}/bookings/${fixture.bookingId}/members/${other.memberId}/status`
			)
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.send({ status: BookingMemberStatus.JOINED })
			.expect(404);
	});

	it.each([BookingStatus.PENDING_RECONFIRMATION, BookingStatus.CANCELLED, BookingStatus.EXPIRED])(
		"rejects participation for Booking status %s",
		async (bookingStatus) => {
			const fixture = await createFixture({ bookingStatus });
			await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(409);
		}
	);

	it.each([
		TripStatus.DRAFT,
		TripStatus.PENDING_APPROVAL,
		TripStatus.CANCELLED,
		TripStatus.COMPLETED,
	])("rejects Trip status %s", async (tripStatus) => {
		const fixture = await createFixture({ tripStatus });
		await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(409);
	});

	it("serializes duplicate joined requests into one transition and audit", async () => {
		const fixture = await createFixture();
		const [first, second] = await Promise.all([
			updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED),
			updateRequest(fixture, fixture.porter, BookingMemberStatus.JOINED),
		]);
		expect([first.status, second.status]).toEqual([200, 200]);
		expect(first.body.checkedInAt).toBe(second.body.checkedInAt);
		const audits = await dataSource.query('SELECT 1 FROM "audit_logs" WHERE "target_id" = $1', [
			fixture.memberId,
		]);
		expect(audits).toHaveLength(1);
	});

	it("allows one result in a concurrent joined/no-show race and rejects the incompatible loser", async () => {
		const fixture = await createFixture({ startsAt: new Date(Date.now() - 60 * 60 * 1000) });
		const [join, noShow] = await Promise.all([
			updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED),
			updateRequest(fixture, fixture.porter, BookingMemberStatus.NO_SHOW),
		]);
		expect([join.status, noShow.status].sort()).toEqual([200, 409]);
		const rows = await dataSource.query(
			'SELECT "member_status" AS "status" FROM "booking_members" WHERE "id" = $1',
			[fixture.memberId]
		);
		expect(rows[0].status).toBe(BookingMemberStatus.NO_SHOW);
	});

	it("records owning Host precedence for a dual-role assigned actor", async () => {
		const fixture = await createFixture({ hostExtraRoles: [UserRole.PORTER] });
		await dataSource.query(
			'INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3)',
			[fixture.tripId, fixture.host.id, TripPorterStatus.ASSIGNED]
		);
		await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(200);
		const rows = await dataSource.query('SELECT "after" FROM "audit_logs" WHERE "target_id" = $1', [
			fixture.memberId,
		]);
		expect(rows[0].after.authorizationPath).toBe("host");
	});

	it("reschedule updates the current Trip start and pending reconfirmation blocks participation", async () => {
		const fixture = await createFixture({ startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000) });
		const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
		newStart.setUTCHours(1, 0, 0, 0);
		const newEnd = new Date(newStart.getTime() + 8 * 60 * 60 * 1000);
		await request(app.getHttpServer())
			.patch(`/api/trips/${fixture.tripId}/reschedule`)
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.send({ startsAt: newStart.toISOString(), endsAt: newEnd.toISOString() })
			.expect(200);
		const rows = await dataSource.query(
			'SELECT "starts_at" AS "startsAt" FROM "trips" WHERE "id" = $1',
			[fixture.tripId]
		);
		expect(new Date(rows[0].startsAt).toISOString()).toBe(newStart.toISOString());
		await updateRequest(fixture, fixture.host, BookingMemberStatus.JOINED).expect(409);
	});

	it("rejects unsupported statuses and unknown fields with 422", async () => {
		const fixture = await createFixture();
		const url = `/api/trips/${fixture.tripId}/bookings/${fixture.bookingId}/members/${fixture.memberId}/status`;
		await request(app.getHttpServer())
			.patch(url)
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.send({ status: BookingMemberStatus.LEFT })
			.expect(422);
		await request(app.getHttpServer())
			.patch(url)
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.send({ status: BookingMemberStatus.JOINED, unknown: true })
			.expect(422);
	});
});
