import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PorterReviewsRepository } from "../src/modules/porter-reviews/porter-reviews.repository";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-389 Porter reviews (real PostgreSQL and HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let repository: PorterReviewsRepository;
	let camper: User;
	let outsider: User;
	let host: User;
	let porter: User;
	let secondPorter: User;
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
		repository = module.get(PorterReviewsRepository);
		await assertSafeTestDatabase(db);
		camper = await account(UserRole.CAMPER);
		outsider = await account(UserRole.CAMPER);
		host = await account(UserRole.HOST);
		porter = await account(UserRole.PORTER);
		secondPorter = await account(UserRole.PORTER);
		await db.query(
			`INSERT INTO trekking_routes
			(id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			VALUES ($1,$2,'Tuyến ven biển Sơn Trà',ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),3500,'moderate',240,'active')`,
			[routeId, host.id]
		);
		await db.query(
			`INSERT INTO trips
			(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			VALUES ($1,$2,$3,'Khám phá bán đảo Sơn Trà','day_trip',0,now()-interval '2 days',now()-interval '1 day',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '3 days',1,20,1,0,'completed')`,
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
		await db.query(
			"INSERT INTO trip_porters (trip_id,porter_id,status) VALUES ($1,$2,'assigned'),($1,$3,'assigned')",
			[tripId, porter.id, secondPorter.id]
		);
	}, 90000);

	async function account(role: UserRole): Promise<User> {
		const saved = await db.getRepository(User).save(
			db.getRepository(User).create({
				email: `porter-review-${randomUUID()}@example.test`,
				fullName: role === UserRole.PORTER ? "Nguyễn Minh Sơn" : "Nguyễn Văn An",
				passwordHash: "unused-test-hash",
				role,
				status: UserStatus.ACTIVE,
			})
		);
		userIds.push(saved.id);
		await db.query("INSERT INTO user_roles (user_id,role) VALUES ($1,$2)", [saved.id, role]);
		return saved;
	}
	const auth = (actor = camper) => `Bearer ${jwt.sign({ sub: actor.id, roles: [actor.role] })}`;
	const create = (
		body: object = { porterId: porter.id, rating: 4 },
		actor = camper,
		booking = bookingId
	) =>
		request(app.getHttpServer())
			.post(`/api/bookings/${booking}/porter-reviews`)
			.set("Authorization", auth(actor))
			.send(body);
	const edit = (id: string, body: object, actor = camper) =>
		request(app.getHttpServer())
			.patch(`/api/porter-reviews/${id}`)
			.set("Authorization", auth(actor))
			.send(body);
	const context = (actor = camper, booking = bookingId) =>
		request(app.getHttpServer())
			.get(`/api/bookings/${booking}/porter-reviews/context`)
			.set("Authorization", auth(actor));
	const rows = () => db.query("SELECT * FROM porter_reviews WHERE booking_id=$1", [bookingId]);
	const history = () =>
		db.query(
			"SELECT * FROM porter_review_revisions WHERE review_id IN (SELECT id FROM porter_reviews WHERE booking_id=$1) ORDER BY revision",
			[bookingId]
		);
	const summary = () => repository.ratingSummary(db.manager, porter.id);

	beforeEach(async () => {
		await db.query(
			"UPDATE bookings SET status='completed',completed_at=now()-interval '1 hour' WHERE id=$1",
			[bookingId]
		);
		await db.query(
			"UPDATE booking_members SET member_status='joined',checked_in_at=now()-interval '2 days',left_at=NULL WHERE id=$1",
			[memberId]
		);
		await db.query("UPDATE trip_porters SET status='assigned' WHERE trip_id=$1", [tripId]);
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (!db?.isInitialized) return;
		await assertSafeTestDatabase(db);
		await db.query(
			"DELETE FROM audit_logs WHERE target_type='porter_review' AND actor_id=ANY($1::uuid[])",
			[userIds]
		);
		await db.query(
			"DELETE FROM porter_review_revisions WHERE review_id IN (SELECT id FROM porter_reviews WHERE booking_id=$1)",
			[bookingId]
		);
		await db.query("DELETE FROM porter_reviews WHERE booking_id=$1", [bookingId]);
	});
	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
			await db.query("DELETE FROM booking_members WHERE booking_id=$1", [bookingId]);
			await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
			await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
		}
		await app?.close();
	});

	it("returns authoritative eligibility, Porter names and one original 24-hour UTC deadline", async () => {
		const res = await context().expect(200);
		expect(res.body).toMatchObject({
			bookingId,
			tripId,
			eligible: true,
			reason: null,
			reviews: [],
		});
		expect(res.body.porters).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					porterId: porter.id,
					porterName: "Nguyễn Minh Sơn",
					canCreate: true,
				}),
				expect.objectContaining({ porterId: secondPorter.id, canCreate: true }),
			])
		);
		expect(res.body.serverTime).toMatch(/Z$/);
		expect(Date.parse(res.body.expiresAt) - Date.parse(res.body.completedAt)).toBe(86400000);
	});
	it("creates one review per actual Porter and preserves normalized source comments", async () => {
		// Force sub-millisecond completion precision to regress the PostgreSQL/JS deadline mismatch.
		await db.query(
			`UPDATE bookings SET completed_at =
			date_trunc('milliseconds', now()-interval '1 hour') + interval '123 microseconds'
			WHERE id=$1`,
			[bookingId]
		);
		const saved = await create({
			porterId: porter.id,
			rating: 5,
			comment: "  <b>Hỗ trợ tốt</b>\nCảm ơn  ",
		}).expect(201);
		await create({ porterId: secondPorter.id, rating: 1 }).expect(201);
		expect(saved.body).toMatchObject({
			bookingId,
			tripId,
			memberId,
			reviewerId: camper.id,
			porterId: porter.id,
			revision: 1,
			moderationStatus: "visible",
			comment: "<b>Hỗ trợ tốt</b>\nCảm ơn",
		});
		expect(await history()).toHaveLength(2);
		expect(
			(await context().expect(200)).body.porters.every(
				(item: { canCreate: boolean }) => !item.canCreate
			)
		).toBe(true);
		expect(await summary()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
	});
	it("rejects duplicate submissions concurrently and keeps one revision and audit", async () => {
		const results = await Promise.all([create(), create()]);
		expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
		expect(await rows()).toHaveLength(1);
		expect(await history()).toHaveLength(1);
		const audit = await db.query(
			"SELECT * FROM audit_logs WHERE target_type='porter_review' AND actor_id=$1",
			[camper.id]
		);
		expect(audit).toHaveLength(1);
		expect(audit[0].after).toEqual(expect.not.objectContaining({ comment: expect.anything() }));
	});
	it("retains, edits and counts an existing review after assignment removal, with no new review", async () => {
		const saved = await create().expect(201);
		await db.query(
			"UPDATE trip_porters SET status='unassigned' WHERE trip_id=$1 AND porter_id=$2",
			[tripId, porter.id]
		);
		const state = await context().expect(200);
		expect(
			state.body.porters.some((item: { porterId: string }) => item.porterId === porter.id)
		).toBe(false);
		expect(state.body.reviews).toContainEqual(
			expect.objectContaining({ id: saved.body.id, porterName: "Nguyễn Minh Sơn", canEdit: true })
		);
		await edit(saved.body.id, { rating: 5, expectedRevision: 1 }).expect(200);
		expect(await summary()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
		await create().expect(404);
		await db.query("UPDATE trip_porters SET status='assigned' WHERE trip_id=$1 AND porter_id=$2", [
			tripId,
			porter.id,
		]);
		await create().expect(409);
		expect(await history()).toHaveLength(2);
	});
	it("keeps an existing review even when all assignments are gone", async () => {
		const saved = await create().expect(201);
		await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
		try {
			const state = await context().expect(200);
			expect(state.body).toMatchObject({
				eligible: false,
				reason: "NO_ELIGIBLE_ASSIGNMENT",
				porters: [],
			});
			expect(state.body.reviews).toContainEqual(
				expect.objectContaining({ id: saved.body.id, canEdit: true })
			);
			await edit(saved.body.id, { rating: 3, expectedRevision: 1 }).expect(200);
			expect(await summary()).toMatchObject({ ratingAverage: 3, ratingCount: 1 });
		} finally {
			await db.query(
				"INSERT INTO trip_porters (trip_id,porter_id,status) VALUES ($1,$2,'assigned'),($1,$3,'assigned')",
				[tripId, porter.id, secondPorter.id]
			);
		}
	});
	it.each(["unassigned", "pending_reconfirmation"])(
		"rejects a %s assignment for creation",
		async (status) => {
			await db.query("UPDATE trip_porters SET status=$3 WHERE trip_id=$1 AND porter_id=$2", [
				tripId,
				porter.id,
				status,
			]);
			await create().expect(404);
			expect(await rows()).toHaveLength(0);
		}
	);
	it("rejects creation if assignment removal commits while verification is waiting", async () => {
		const runner = db.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		try {
			await runner.query(
				"UPDATE trip_porters SET status='unassigned' WHERE trip_id=$1 AND porter_id=$2",
				[tripId, porter.id]
			);
			let settled = false;
			const pending = create().then((res) => {
				settled = true;
				return res;
			});
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(settled).toBe(false);
			await runner.commitTransaction();
			expect((await pending).status).toBe(404);
			expect(await rows()).toHaveLength(0);
		} finally {
			if (runner.isTransactionActive) await runner.rollbackTransaction();
			await runner.release();
		}
	});
	it("enforces uniqueness in PostgreSQL even when bypassing the HTTP service", async () => {
		const saved = await create().expect(201);
		await expect(
			db.query(
				`INSERT INTO porter_reviews
			(id,booking_id,member_id,reviewer_id,trip_id,porter_id,rating,comment,revision,
			moderation_status,edit_expires_at,created_at,updated_at)
			SELECT gen_random_uuid(),booking_id,member_id,reviewer_id,trip_id,porter_id,rating,
			comment,revision,moderation_status,edit_expires_at,created_at,updated_at
			FROM porter_reviews WHERE id=$1`,
				[saved.body.id]
			)
		).rejects.toMatchObject({ driverError: { code: "23505" } });
		expect(await rows()).toHaveLength(1);
	});
	it("uses the same 404 for unrelated targets, missing bookings and another account", async () => {
		const unrelated = await create({ porterId: outsider.id, rating: 4 }).expect(404);
		const missing = await create(undefined, camper, randomUUID()).expect(404);
		const foreign = await context(outsider).expect(404);
		expect(unrelated.body).toEqual(missing.body);
		expect(foreign.body).toEqual(missing.body);
		const saved = await create().expect(201);
		const otherReview = await edit(
			saved.body.id,
			{ rating: 1, expectedRevision: 1 },
			outsider
		).expect(404);
		const absentReview = await edit(
			randomUUID(),
			{ rating: 1, expectedRevision: 1 },
			outsider
		).expect(404);
		expect(otherReview.body).toEqual(absentReview.body);
	});
	it("requires authentication and Camper role", async () => {
		await request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}/porter-reviews/context`)
			.expect(401);
		await context(host).expect(403);
		await create(undefined, porter).expect(403);
	});
	it.each([
		"UPDATE bookings SET status='confirmed' WHERE id=$1",
		"UPDATE bookings SET completed_at=NULL WHERE id=$1",
		"UPDATE bookings SET completed_at=now()+interval '1 hour' WHERE id=$1",
	])("rejects an incomplete or future booking: %s", async (sql) => {
		await db.query(sql, [bookingId]);
		expect((await context().expect(200)).body.reason).toBe("PARTICIPATION_NOT_COMPLETED");
		await create().expect(409);
	});
	it.each([
		"member_status='no_show'",
		"member_status='registered'",
		"member_status='removed'",
		"member_status='left'",
		"checked_in_at=NULL",
		"left_at=now()",
		"checked_in_at=now()",
	])("rejects invalid participation: %s", async (condition) => {
		await db.query(`UPDATE booking_members SET ${condition} WHERE id=$1`, [memberId]);
		await create().expect(409);
	});
	it("does not treat the primary booker as another linked guest", async () => {
		await db.query("UPDATE booking_members SET user_id=$2 WHERE id=$1", [memberId, outsider.id]);
		try {
			await context().expect(404);
			await create().expect(404);
			await create(undefined, outsider).expect(201);
		} finally {
			await db.query("UPDATE booking_members SET user_id=$2 WHERE id=$1", [memberId, camper.id]);
		}
	});
	it("closes both create and edit exactly at completion + 24 hours", async () => {
		const saved = await create().expect(201);
		const completion = new Date("2026-11-01T01:00:00Z");
		const deadline = new Date(completion.getTime() + 86400000);
		await db.query("UPDATE bookings SET completed_at=$2 WHERE id=$1", [bookingId, completion]);
		await db.query("UPDATE booking_members SET checked_in_at=$2 WHERE id=$1", [
			memberId,
			new Date(completion.getTime() - 1000),
		]);
		await db.query(
			"UPDATE porter_reviews SET created_at=$2,updated_at=$2,edit_expires_at=$3 WHERE id=$1",
			[saved.body.id, new Date(deadline.getTime() - 1000), deadline]
		);
		jest.spyOn(repository, "now").mockResolvedValue(deadline);
		await create({ porterId: secondPorter.id, rating: 4 }).expect(409);
		await edit(saved.body.id, { rating: 3, expectedRevision: 1 }).expect(409);
		expect((await context().expect(200)).body.reviews[0].canEdit).toBe(false);
	});
	it("checks the database wall clock after waiting for a participation lock", async () => {
		const before = await context().expect(200);
		const deadline = new Date(Date.now() + 350);
		await db.query("UPDATE bookings SET completed_at=$2 WHERE id=$1", [
			bookingId,
			new Date(deadline.getTime() - 86400000),
		]);
		await db.query("UPDATE booking_members SET checked_in_at=$2 WHERE id=$1", [
			memberId,
			new Date(deadline.getTime() - 172800000),
		]);
		const runner = db.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		try {
			await runner.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [bookingId]);
			const pending = create().then((res) => res);
			await new Promise((resolve) => setTimeout(resolve, 550));
			await runner.commitTransaction();
			expect((await pending).status).toBe(409);
			expect(Date.parse(before.body.serverTime)).toBeLessThan(deadline.getTime());
		} finally {
			if (runner.isTransactionActive) await runner.rollbackTransaction();
			await runner.release();
		}
	});
	it("serializes edits and rejects the losing stale revision", async () => {
		const saved = await create({
			porterId: porter.id,
			rating: 4,
			comment: "Nội dung ban đầu",
		}).expect(201);
		const results = await Promise.all([
			edit(saved.body.id, { rating: 1, expectedRevision: 1 }),
			edit(saved.body.id, { rating: 5, expectedRevision: 1 }),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
		const revisions = await history();
		expect(revisions).toHaveLength(2);
		expect(revisions[0]).toMatchObject({ rating: 4, comment: "Nội dung ban đầu", revision: 1 });
		expect(revisions[1].comment).toBe("Nội dung ban đầu");
	});
	it("normalizes blank edits to null and rejects client mutation of the Porter", async () => {
		const saved = await create({ porterId: porter.id, rating: 4, comment: "Cảm ơn" }).expect(201);
		await edit(saved.body.id, { rating: 5, expectedRevision: 1, porterId: secondPorter.id }).expect(
			422
		);
		const updated = await edit(saved.body.id, {
			rating: 5,
			expectedRevision: 1,
			comment: "  ",
		}).expect(200);
		expect(updated.body).toMatchObject({ comment: null, editExpiresAt: saved.body.editExpiresAt });
		expect(await history()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ comment: "Cảm ơn" }),
				expect.objectContaining({ comment: null }),
			])
		);
	});
	it.each([0, 6, 1.5, "4", null])("rejects invalid HTTP rating %p", async (rating) => {
		await create({ porterId: porter.id, rating }).expect(422);
	});
	it("rejects overlong comments and forged authoritative fields", async () => {
		await create({ porterId: porter.id, rating: 4, comment: "a".repeat(2001) }).expect(422);
		await create({ porterId: porter.id, rating: 4, reviewerId: outsider.id }).expect(422);
		await context(camper, "invalid").expect(422);
		expect(await rows()).toHaveLength(0);
	});
	it("rolls back review and revision when the database rejects its audit", async () => {
		await assertSafeTestDatabase(db);
		// Restrict the injected fault to this fixture's actor and new review type.
		await db.query(`ALTER TABLE audit_logs ADD CONSTRAINT ctms389_reject_audit
			CHECK (target_type <> 'porter_review' OR actor_id <> '${camper.id}'::uuid) NOT VALID`);
		try {
			await create().expect(500);
			expect(await rows()).toHaveLength(0);
			expect(await history()).toHaveLength(0);
		} finally {
			await db.query("ALTER TABLE audit_logs DROP CONSTRAINT ctms389_reject_audit");
		}
	});
	it("rolls back edits when revision persistence fails", async () => {
		const saved = await create().expect(201);
		jest.spyOn(repository, "recordRevision").mockRejectedValue(new Error("revision failure"));
		await edit(saved.body.id, { rating: 1, expectedRevision: 1 }).expect(500);
		expect((await rows())[0]).toMatchObject({ rating: 4, revision: 1 });
		expect(await history()).toHaveLength(1);
	});
	it("excludes hidden or ineligible reviews and returns null average for zero eligible ratings", async () => {
		expect(await summary()).toMatchObject({ ratingAverage: null, ratingCount: 0 });
		const saved = await create().expect(201);
		await db.query("UPDATE porter_reviews SET moderation_status='hidden' WHERE id=$1", [
			saved.body.id,
		]);
		expect(await summary()).toMatchObject({ ratingAverage: null, ratingCount: 0 });
		await db.query("UPDATE porter_reviews SET moderation_status='visible' WHERE id=$1", [
			saved.body.id,
		]);
		await db.query("UPDATE booking_members SET member_status='removed' WHERE id=$1", [memberId]);
		expect(await summary()).toMatchObject({ ratingAverage: null, ratingCount: 0 });
	});
	it("keeps exactly one contribution after edits and expiry", async () => {
		const saved = await create().expect(201);
		await edit(saved.body.id, { rating: 2, expectedRevision: 1 }).expect(200);
		await edit(saved.body.id, { rating: 5, expectedRevision: 2 }).expect(200);
		jest
			.spyOn(repository, "now")
			.mockResolvedValue(new Date(Date.parse(saved.body.editExpiresAt) + 1));
		expect(await summary()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
		await edit(saved.body.id, { rating: 1, expectedRevision: 3 }).expect(409);
	});
	it("aggregates distinct reviewers once and excludes only moderated-out ratings", async () => {
		await create({ porterId: porter.id, rating: 5 }).expect(201);
		const guestId = randomUUID();
		await db.query(
			`INSERT INTO booking_members
			(id,booking_id,user_id,is_primary,member_status,checked_in_at)
			VALUES ($1,$2,$3,false,'joined',now()-interval '2 days')`,
			[guestId, bookingId, outsider.id]
		);
		try {
			const guest = await create({ porterId: porter.id, rating: 2 }, outsider).expect(201);
			expect(await summary()).toMatchObject({ ratingAverage: 3.5, ratingCount: 2 });
			await db.query("UPDATE porter_reviews SET moderation_status='hidden' WHERE id=$1", [
				guest.body.id,
			]);
			expect(await summary()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
		} finally {
			await db.query(
				"DELETE FROM porter_review_revisions WHERE review_id IN (SELECT id FROM porter_reviews WHERE member_id=$1)",
				[guestId]
			);
			await db.query("DELETE FROM porter_reviews WHERE member_id=$1", [guestId]);
			await db.query("DELETE FROM booking_members WHERE id=$1", [guestId]);
		}
	});
});
