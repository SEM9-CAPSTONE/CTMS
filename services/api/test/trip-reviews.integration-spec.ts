import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-387 Trip/Host reviews (real Postgres)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let camper: User;
	let outsider: User;
	let host: User;
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingId = randomUUID();
	const memberId = randomUUID();
	const userIds: string[] = [];

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication();
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
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		await assertSafeTestDatabase(db);
		camper = await account(UserRole.CAMPER);
		outsider = await account(UserRole.CAMPER);
		host = await account(UserRole.HOST);
		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			VALUES ($1,$2,'Review test route',ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),3500,'moderate',240,'active')`,
			[routeId, host.id]
		);
		await db.query(
			`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			VALUES ($1,$2,$3,'Review test trip','day_trip',0,now()-interval '2 days',now()-interval '1 day',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '3 days',1,20,1,0,'completed')`,
			[tripId, host.id, routeId]
		);
		await db.query(
			`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,completed_at)
			VALUES ($1,$2,$3,1,'completed','not_required',now()-interval '1 hour')`,
			[bookingId, tripId, camper.id]
		);
		await db.query(
			`INSERT INTO booking_members (id,booking_id,user_id,is_primary,member_status,checked_in_at)
			VALUES ($1,$2,$3,true,'joined',now()-interval '2 days')`,
			[memberId, bookingId, camper.id]
		);
	}, 60000);

	async function account(role: UserRole): Promise<User> {
		const user = await db.getRepository(User).save(
			db.getRepository(User).create({
				email: `review-${randomUUID()}@example.test`,
				passwordHash: "unused-test-hash",
				role,
				status: UserStatus.ACTIVE,
			})
		);
		userIds.push(user.id);
		await db.query("INSERT INTO user_roles (user_id,role) VALUES ($1,$2)", [user.id, role]);
		return user;
	}
	const auth = (user = camper) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;
	const create = (body: object = { target: "trip", rating: 4 }, actor = camper) =>
		request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/reviews`)
			.set("Authorization", auth(actor))
			.send(body);
	const edit = (id: string, body: object, actor = camper) =>
		request(app.getHttpServer())
			.patch(`/api/trip-reviews/${id}`)
			.set("Authorization", auth(actor))
			.send(body);
	const context = (actor = camper) =>
		request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}/reviews/context`)
			.set("Authorization", auth(actor));
	const reviews = () => db.query("SELECT * FROM trip_reviews WHERE booking_id=$1", [bookingId]);
	const revisions = () =>
		db.query(
			"SELECT * FROM trip_review_revisions WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id=$1) ORDER BY revision",
			[bookingId]
		);

	beforeEach(async () => {
		await db.query(
			"UPDATE bookings SET status='completed', completed_at=now()-interval '1 hour' WHERE id=$1",
			[bookingId]
		);
		await db.query(
			"UPDATE booking_members SET member_status='joined',checked_in_at=now()-interval '2 days',left_at=NULL WHERE id=$1",
			[memberId]
		);
	});
	afterEach(async () => {
		if (!db?.isInitialized) return;
		await assertSafeTestDatabase(db);
		await db.query(
			"DELETE FROM audit_logs WHERE target_type='trip_review' AND actor_id=ANY($1::uuid[])",
			[userIds]
		);
		await db.query(
			"DELETE FROM trip_review_revisions WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id=$1)",
			[bookingId]
		);
		await db.query("DELETE FROM trip_reviews WHERE booking_id=$1", [bookingId]);
	});
	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM booking_members WHERE booking_id=$1", [bookingId]);
			await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
			await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
		}
		await app?.close();
	});

	it("creates distinct Trip and Host reviews using authoritative targets and optional comments", async () => {
		const trip = await create({ target: "trip", rating: 5, comment: "  Good trip  " }).expect(201);
		const hostReview = await create({ target: "host", rating: 3 }).expect(201);
		expect(trip.body).toMatchObject({
			tripId,
			hostId: host.id,
			targetId: tripId,
			reviewerId: camper.id,
			memberId,
			comment: "Good trip",
			revision: 1,
		});
		expect(hostReview.body).toMatchObject({ targetId: host.id, rating: 3, comment: null });
		expect(await revisions()).toHaveLength(2);
		const res = await context().expect(200);
		expect(res.body.eligible).toBe(true);
		expect(res.body.reviews).toHaveLength(2);
		expect(new Date(res.body.expiresAt).getTime() - new Date(res.body.completedAt).getTime()).toBe(
			86400000
		);
	});
	it("serializes concurrent duplicate creates and stores one review/revision/audit", async () => {
		const results = await Promise.all(Array.from({ length: 4 }, () => create()));
		expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409, 409]);
		expect(await reviews()).toHaveLength(1);
		expect(await revisions()).toHaveLength(1);
		const audit = await db.query(
			"SELECT * FROM audit_logs WHERE target_type='trip_review' AND actor_id=$1",
			[camper.id]
		);
		expect(audit).toHaveLength(1);
	});
	it("retains original content and identities across edits, rejects stale and concurrent revisions", async () => {
		const created = await create({ target: "trip", rating: 2, comment: "Original" }).expect(201);
		const results = await Promise.all([
			edit(created.body.id, { rating: 4, expectedRevision: 1, comment: "Edited" }),
			edit(created.body.id, { rating: 5, expectedRevision: 1 }),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
		const history = await revisions();
		expect(history).toHaveLength(2);
		expect(history[0]).toMatchObject({ rating: 2, comment: "Original", revision: 1 });
		const [row] = await reviews();
		expect(row).toMatchObject({
			reviewer_id: camper.id,
			member_id: memberId,
			trip_id: tripId,
			host_id: host.id,
			target_id: tripId,
			revision: 2,
		});
		await edit(created.body.id, { rating: 1, expectedRevision: 1 }).expect(409);
	});
	it("enforces own participation, authentication, roles and edit ownership", async () => {
		await context(outsider).expect(403);
		await create({}, outsider).expect(422);
		await create({ target: "trip", rating: 4 }, outsider).expect(403);
		await create({ target: "trip", rating: 4 }, host).expect(403);
		await request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}/reviews/context`)
			.expect(401);
		const created = await create().expect(201);
		await edit(created.body.id, { rating: 1, expectedRevision: 1 }, outsider).expect(403);
		await edit(randomUUID(), { rating: 1, expectedRevision: 1 }).expect(404);
	});
	it.each(["no_show", "registered", "removed", "left"])(
		"rejects %s even when Booking is completed",
		async (status) => {
			await db.query("UPDATE booking_members SET member_status=$2 WHERE id=$1", [memberId, status]);
			await create().expect(409);
			expect((await context().expect(200)).body.reason).toBe("PARTICIPATION_NOT_COMPLETED");
		}
	);
	it("rejects uncompleted bookings, missing check-in and future completion", async () => {
		await db.query("UPDATE bookings SET status='confirmed' WHERE id=$1", [bookingId]);
		await create().expect(409);
		await db.query(
			"UPDATE bookings SET status='completed',completed_at=now()+interval '1 hour' WHERE id=$1",
			[bookingId]
		);
		await create().expect(409);
		await db.query("UPDATE bookings SET completed_at=now()-interval '1 hour' WHERE id=$1", [
			bookingId,
		]);
		await db.query("UPDATE booking_members SET checked_in_at=NULL WHERE id=$1", [memberId]);
		await create().expect(409);
	});
	it("expiry prevents both creation and owner edits without losing old evidence", async () => {
		const created = await create().expect(201);
		await db.query("UPDATE bookings SET completed_at=now()-interval '24 hours' WHERE id=$1", [
			bookingId,
		]);
		await create({ target: "host", rating: 4 }).expect(409);
		await edit(created.body.id, { rating: 2, expectedRevision: 1 }).expect(409);
		expect((await context().expect(200)).body.reason).toBe("WINDOW_EXPIRED");
		expect(await revisions()).toHaveLength(1);
	});
	it.each([
		{ rating: 0 },
		{ rating: 6 },
		{ rating: 2.5 },
		{ rating: "5" },
		{ comment: 123 },
		{ comment: "x".repeat(2001) },
		{ hostId: randomUUID() },
		{ reviewerId: randomUUID() },
		{ target: "porter" },
	])("rejects invalid or forged payload %p", async (extra) => {
		await create({ target: "trip", rating: 4, ...extra }).expect(422);
		expect(await reviews()).toHaveLength(0);
	});
	it("accepts 2000 characters and normalizes a blank edit to null", async () => {
		const created = await create({ target: "host", rating: 1, comment: "x".repeat(2000) }).expect(
			201
		);
		const updated = await edit(created.body.id, {
			rating: 5,
			comment: " \n ",
			expectedRevision: 1,
		}).expect(200);
		expect(updated.body.comment).toBeNull();
		expect((await revisions())[0].comment).toHaveLength(2000);
	});
	it("rolls back review and revision if audit persistence fails", async () => {
		const functionName = `review_audit_failure_${randomUUID().replace(/-/g, "")}`;
		await db.query(
			`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'review audit failure'; END; $$`
		);
		try {
			await db.query(
				`CREATE TRIGGER ${functionName} BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.actor_id = '${camper.id}'::uuid AND NEW.target_type = 'trip_review') EXECUTE FUNCTION ${functionName}()`
			);
			await create().expect(500);
			expect(await reviews()).toHaveLength(0);
			expect(await revisions()).toHaveLength(0);
		} finally {
			await db.query(`DROP TRIGGER IF EXISTS ${functionName} ON audit_logs`);
			await db.query(`DROP FUNCTION ${functionName}()`);
		}
	});
	it("DB constraints prevent invalid ratings, target mismatch and destructive parent deletion", async () => {
		const created = await create().expect(201);
		await expect(
			db.query("UPDATE trip_reviews SET rating=6 WHERE id=$1", [created.body.id])
		).rejects.toThrow();
		await expect(
			db.query("UPDATE trip_reviews SET target_id=$2 WHERE id=$1", [created.body.id, host.id])
		).rejects.toThrow();
		await expect(db.query("DELETE FROM bookings WHERE id=$1", [bookingId])).rejects.toThrow();
		expect(await revisions()).toHaveLength(1);
	});
});
