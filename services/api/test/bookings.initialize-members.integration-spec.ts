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

interface RosterFixture {
	bookingId: string;
	tripId: string;
	host: Account;
	owner: Account;
	participant: Account;
}

describe("POST /api/bookings/:bookingId/members (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
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

	async function createAccount(
		role: UserRole = UserRole.CAMPER,
		status: UserStatus = UserStatus.ACTIVE
	): Promise<Account> {
		const id = randomUUID();
		const email = `member-${id}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, email, passwordHash, role, status, `Member ${id}`]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, email, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createFixture(
		options: {
			status?: BookingStatus;
			numPeople?: number;
			startsAt?: Date;
		} = {}
	): Promise<RosterFixture> {
		const host = await createAccount(UserRole.HOST);
		const owner = await createAccount();
		const participant = await createAccount();
		const routeId = randomUUID();
		const tripId = randomUUID();
		const bookingId = randomUUID();
		const numPeople = options.numPeople ?? 2;
		const startsAt = options.startsAt ?? new Date("2035-10-10T01:00:00Z");
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
			[routeId, host.id, `Member route ${routeId}`, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			) VALUES (
				$1, $2, $3, 'Roster integration Trip', 'day_trip', 0, $4,
				$4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 10, $5, 100000, $6
			)`,
			[tripId, host.id, routeId, startsAt, numPeople, TripStatus.PUBLISHED]
		);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"hold_expires_at", "trip_starts_at_snapshot", "trip_ends_at_snapshot",
				"base_price", "total_amount"
			) VALUES ($1, $2, $3, $4, $5, 'unpaid', now() + interval '15 minutes', $6,
				$6::timestamptz + interval '8 hours', 100000, 100000)`,
			[
				bookingId,
				tripId,
				owner.id,
				numPeople,
				options.status ?? BookingStatus.PENDING_PAYMENT,
				startsAt,
			]
		);

		return { bookingId, tripId, host, owner, participant };
	}

	function resolveCandidateRequest(
		fixture: RosterFixture,
		email: string,
		accessToken = fixture.owner.accessToken
	) {
		return request(app.getHttpServer())
			.post(`/api/bookings/${fixture.bookingId}/member-candidates/resolve`)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ email });
	}

	function initializeRequest(fixture: RosterFixture, key: string) {
		return request(app.getHttpServer())
			.post(`/api/bookings/${fixture.bookingId}/members`)
			.set("Authorization", `Bearer ${fixture.owner.accessToken}`)
			.set("Idempotency-Key", key)
			.send({ members: [{ userId: fixture.participant.id }] });
	}

	it("inserts the complete roster with exactly one owner-primary and leaves seats unchanged", async () => {
		const fixture = await createFixture();
		const response = await initializeRequest(fixture, randomUUID()).expect(201);

		expect(response.body.members).toHaveLength(2);
		expect(
			response.body.members.filter((member: { isPrimary: boolean }) => member.isPrimary)
		).toHaveLength(1);
		expect(
			response.body.members.find((member: { isPrimary: boolean }) => member.isPrimary).userId
		).toBe(fixture.owner.id);
		const tripRows = await dataSource.query('SELECT "seats_taken" FROM "trips" WHERE "id" = $1', [
			fixture.tripId,
		]);
		expect(tripRows[0].seats_taken).toBe(2);
		const audits = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1',
			[fixture.bookingId]
		);
		expect(audits).toEqual([{ action: "booking.members_initialized" }]);
	});

	it("enforces unique Booking/user identity in PostgreSQL", async () => {
		const fixture = await createFixture();
		await initializeRequest(fixture, randomUUID()).expect(201);

		await expect(
			dataSource.query(
				`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary")
				 VALUES ($1, $2, false)`,
				[fixture.bookingId, fixture.participant.id]
			)
		).rejects.toMatchObject({ code: "23505" });
	});

	it("enforces at most one primary member in PostgreSQL", async () => {
		const fixture = await createFixture();
		const extraParticipant = await createAccount();
		await initializeRequest(fixture, randomUUID()).expect(201);

		await expect(
			dataSource.query(
				`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary")
				 VALUES ($1, $2, true)`,
				[fixture.bookingId, extraParticipant.id]
			)
		).rejects.toMatchObject({ code: "23505" });
	});

	it("serializes concurrent same-key requests into one roster and one audit", async () => {
		const fixture = await createFixture();
		const key = randomUUID();
		const [first, second] = await Promise.all([
			initializeRequest(fixture, key),
			initializeRequest(fixture, key),
		]);

		expect([first.status, second.status]).toEqual([201, 201]);
		expect(first.body.members.map((member: { id: string }) => member.id).sort()).toEqual(
			second.body.members.map((member: { id: string }) => member.id).sort()
		);
		const members = await dataSource.query(
			'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1',
			[fixture.bookingId]
		);
		const audits = await dataSource.query(
			'SELECT "id" FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[fixture.bookingId, "booking.members_initialized"]
		);
		expect(members).toHaveLength(2);
		expect(audits).toHaveLength(1);
	});

	it("rolls back all roster rows when audit persistence fails", async () => {
		const fixture = await createFixture();
		await dataSource.query(`
			CREATE OR REPLACE FUNCTION reject_members_initialized_audit()
			RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW.action = 'booking.members_initialized' THEN
					RAISE EXCEPTION 'forced member audit failure';
				END IF;
				RETURN NEW;
			END $$
		`);
		await dataSource.query(`
			CREATE TRIGGER "TRG_test_reject_members_initialized_audit"
			BEFORE INSERT ON "audit_logs"
			FOR EACH ROW EXECUTE FUNCTION reject_members_initialized_audit()
		`);
		try {
			await initializeRequest(fixture, randomUUID()).expect(500);
			const members = await dataSource.query(
				'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1',
				[fixture.bookingId]
			);
			const initializations = await dataSource.query(
				'SELECT "id" FROM "booking_member_initializations" WHERE "booking_id" = $1',
				[fixture.bookingId]
			);
			expect(members).toHaveLength(0);
			expect(initializations).toHaveLength(0);
		} finally {
			await dataSource.query(
				'DROP TRIGGER IF EXISTS "TRG_test_reject_members_initialized_audit" ON "audit_logs"'
			);
			await dataSource.query("DROP FUNCTION IF EXISTS reject_members_initialized_audit()");
		}
	});

	it("creates no partial rows when a participant user is missing", async () => {
		const fixture = await createFixture();
		await request(app.getHttpServer())
			.post(`/api/bookings/${fixture.bookingId}/members`)
			.set("Authorization", `Bearer ${fixture.owner.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ members: [{ userId: randomUUID() }] })
			.expect(404);
		const members = await dataSource.query(
			'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1',
			[fixture.bookingId]
		);
		expect(members).toHaveLength(0);
	});

	it("keeps an explicitly uninitialized legacy Booking readable with zero members", async () => {
		const fixture = await createFixture({ numPeople: 1 });
		const rows = await dataSource.query(
			`SELECT b."id", COUNT(bm."id")::int AS "memberCount"
			 FROM "bookings" b
			 LEFT JOIN "booking_members" bm ON bm."booking_id" = b."id"
			 WHERE b."id" = $1
			 GROUP BY b."id"`,
			[fixture.bookingId]
		);
		expect(rows).toEqual([{ id: fixture.bookingId, memberCount: 0 }]);
	});

	it("resolves an active participant by normalized exact email with a minimal response", async () => {
		const fixture = await createFixture();
		const response = await resolveCandidateRequest(
			fixture,
			`  ${fixture.participant.email.toUpperCase()}  `
		).expect(200);

		expect(response.body).toEqual({
			userId: fixture.participant.id,
			email: fixture.participant.email,
		});
		expect(Object.keys(response.body).sort()).toEqual(["email", "userId"]);
	});

	it("uses the same privacy-safe 404 for missing and every inactive participant status", async () => {
		const fixture = await createFixture();
		const missing = await resolveCandidateRequest(fixture, "missing@example.com").expect(404);
		expect(missing.body.message).toBe("Eligible participant not found");
		for (const status of [
			UserStatus.PENDING_VERIFICATION,
			UserStatus.SUSPENDED,
			UserStatus.DELETED,
		]) {
			const inactive = await createAccount(UserRole.CAMPER, status);
			const response = await resolveCandidateRequest(fixture, inactive.email).expect(404);
			expect(response.body).toEqual(missing.body);
		}
	});

	it("rejects an inactive authenticated caller", async () => {
		const fixture = await createFixture();
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
			UserStatus.SUSPENDED,
			fixture.owner.id,
		]);
		await resolveCandidateRequest(
			fixture,
			fixture.participant.email,
			fixture.owner.accessToken
		).expect(401);
	});

	it("rejects non-owners, non-Campers, and unauthenticated callers", async () => {
		const fixture = await createFixture();
		await resolveCandidateRequest(
			fixture,
			fixture.participant.email,
			fixture.participant.accessToken
		).expect(403);
		await resolveCandidateRequest(
			fixture,
			fixture.participant.email,
			fixture.host.accessToken
		).expect(403);
		await request(app.getHttpServer())
			.post(`/api/bookings/${fixture.bookingId}/member-candidates/resolve`)
			.send({ email: fixture.participant.email })
			.expect(401);
	});

	it("validates both the Booking id and email payload", async () => {
		const fixture = await createFixture();
		await resolveCandidateRequest(fixture, "not-an-email").expect(422);
		await request(app.getHttpServer())
			.post("/api/bookings/not-a-uuid/member-candidates/resolve")
			.set("Authorization", `Bearer ${fixture.owner.accessToken}`)
			.send({ email: fixture.participant.email })
			.expect(422);
	});

	it("preserves the existing Admin-only users directory behavior", async () => {
		const fixture = await createFixture();
		const admin = await createAccount(UserRole.ADMIN);
		await request(app.getHttpServer())
			.get("/api/users")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		await request(app.getHttpServer())
			.get("/api/users")
			.set("Authorization", `Bearer ${fixture.owner.accessToken}`)
			.expect(403);
	});
});
