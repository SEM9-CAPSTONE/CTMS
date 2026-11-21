import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AddContentReportSubmission1796200000000 } from "../src/migrations/1796200000000-AddContentReportSubmission";
import { AppModule } from "../src/modules/app.module";
import { ContentReport } from "../src/modules/content-reports/entities/content-report.entity";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-391 report submission (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let host: User;
	let camper: User;
	let admin: User;
	const createdAccounts: string[] = [];
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingId = randomUUID();
	const memberId = randomUUID();
	const reviewId = randomUUID();
	const legacyId = randomUUID();

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
		// Reuse the three primary accounts throughout this isolated test suite.
		host = await primary("host@ctms.local", UserRole.HOST, "Lê Minh Quân");
		camper = await primary("camper@ctms.local", UserRole.CAMPER, "Nguyễn Thanh Hà");
		admin = await primary("admin@ctms.local", UserRole.ADMIN, "Trần Minh Anh");
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			VALUES($1,$2,'Đường mòn Sơn Trà',ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),3500,'moderate',240,'active')`,
			[routeId, host.id]
		);
		await db.query(
			`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			VALUES($1,$2,$3,'Khám phá bán đảo Sơn Trà','day_trip',0,now()-interval '2 days',now()-interval '1 day',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '3 days',1,20,1,0,'completed')`,
			[tripId, host.id, routeId]
		);
		await db.query(
			`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,completed_at)
			VALUES($1,$2,$3,1,'completed','not_required',now()-interval '1 hour')`,
			[bookingId, tripId, camper.id]
		);
		await db.query(
			`INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at)
			VALUES($1,$2,$3,true,'joined',now()-interval '2 days')`,
			[memberId, bookingId, camper.id]
		);
		// A persisted review identity is a fixture; review creation authorization is covered by its own suite.
		await db.query(
			`INSERT INTO trip_reviews(id,booking_id,member_id,reviewer_id,trip_id,host_id,target,target_id,rating,comment)
			VALUES($1,$2,$3,$4,$5,$6,'trip',$5,4,'Cần kiểm tra lại thông tin về đoạn đường ven suối.')`,
			[reviewId, bookingId, memberId, admin.id, tripId, host.id]
		);
	}, 60000);

	async function primary(email: string, role: UserRole, fullName: string): Promise<User> {
		const repository = db.getRepository(User);
		const existing = await repository.findOneBy({ email });
		if (existing) return existing;
		const user = await repository.save(
			repository.create({
				email,
				role,
				fullName,
				status: UserStatus.ACTIVE,
				passwordHash: "unused-integration-fixture",
			})
		);
		createdAccounts.push(user.id);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [user.id, role]);
		return user;
	}
	const auth = (user = camper) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;
	const body = () => ({
		idempotencyKey: randomUUID(),
		reportType: "dangerous_content",
		targetType: "trip_review",
		targetId: reviewId,
		description: "Thông tin đi qua suối khi mưa lớn có thể gây nguy hiểm.",
	});
	const submit = (payload: object, user = camper) =>
		request(app.getHttpServer())
			.post("/api/me/content-reports")
			.set("Authorization", auth(user))
			.send(payload);
	const own = (id: string, user = camper) =>
		request(app.getHttpServer())
			.get(`/api/me/content-reports/${id}`)
			.set("Authorization", auth(user));
	const reports = () => db.query("SELECT * FROM content_reports WHERE target_id=$1", [reviewId]);
	const audits = () =>
		db.query(
			"SELECT * FROM audit_logs WHERE action='content_report.created' AND target_id IN (SELECT id FROM content_reports WHERE target_id=$1)",
			[reviewId]
		);

	beforeEach(async () => {
		await assertSafeTestDatabase(db);
		await db.query("UPDATE booking_members SET member_status='joined',left_at=NULL WHERE id=$1", [
			memberId,
		]);
		await db.query("UPDATE trip_reviews SET reviewer_id=$2 WHERE id=$1", [reviewId, admin.id]);
	});
	afterEach(async () => {
		if (!db?.isInitialized) return;
		await assertSafeTestDatabase(db);
		await db.query(
			"DELETE FROM audit_logs WHERE target_type='content_report' AND target_id IN (SELECT id FROM content_reports WHERE target_id=$1)",
			[reviewId]
		);
		await db.query("DELETE FROM content_reports WHERE target_id=$1 OR id=$2", [reviewId, legacyId]);
	});
	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM trip_reviews WHERE id=$1", [reviewId]);
			await db.query("DELETE FROM booking_members WHERE id=$1", [memberId]);
			await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
			await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [createdAccounts]);
		}
		await app?.close();
	});

	it("persists type/context, lets Admin review and keeps owner responses private", async () => {
		const result = await submit(body()).expect(200);
		expect(result.body).toMatchObject({
			status: "pending",
			targetId: reviewId,
			reportType: "dangerous_content",
		});
		expect(result.body).not.toHaveProperty("requestHash");
		expect(result.body).not.toHaveProperty("reporter");
		await own(result.body.id).expect(200);
		await own(result.body.id, host).expect(404);
		const adminView = await request(app.getHttpServer())
			.get(`/api/content-reports/${result.body.id}`)
			.set("Authorization", auth(admin))
			.expect(200);
		expect(adminView.body).toMatchObject({
			reportType: "dangerous_content",
			reporter: { id: camper.id },
		});
		await request(app.getHttpServer())
			.get(`/api/content-reports/${result.body.id}`)
			.set("Authorization", auth(camper))
			.expect(403);
		expect(await audits()).toHaveLength(1);
	});
	it("allows the actual Host", async () => {
		await submit(body(), host).expect(200);
	});
	it("preserves retry metadata through the existing Admin moderation API", async () => {
		const payload = body();
		const first = await submit(payload).expect(200);
		for (const [expectedStatus, status] of [
			["pending", "reviewing"],
			["reviewing", "actioned"],
		]) {
			await request(app.getHttpServer())
				.patch(`/api/content-reports/${first.body.id}/status`)
				.set("Authorization", auth(admin))
				.send({ expectedStatus, status })
				.expect(200);
		}
		const retry = await submit(payload).expect(200);
		expect(retry.body).toMatchObject({
			id: first.body.id,
			status: "actioned",
			reportType: payload.reportType,
		});
		await submit(body()).expect(200);
	});
	it("accepts inaccurate_information as a separate stable type", async () => {
		const result = await submit({ ...body(), reportType: "inaccurate_information" }).expect(200);
		expect(result.body.reportType).toBe("inaccurate_information");
	});
	it("rejects self-reporting even for the actual Host", async () => {
		await db.query("UPDATE trip_reviews SET reviewer_id=$2 WHERE id=$1", [reviewId, host.id]);
		await submit(body(), host).expect(404);
	});
	it("enforces complete and supported submission metadata in PostgreSQL", async () => {
		await expect(
			db.query(
				`INSERT INTO content_reports(reporter_id,target_type,target_id,reason,report_type,idempotency_key,request_hash)
			VALUES($1,'trip_review',$2,'Thông tin đường đi chưa chính xác.','unsupported',$3,$4)`,
				[camper.id, reviewId, randomUUID(), "a".repeat(64)]
			)
		).rejects.toMatchObject({ driverError: { code: "23514" } });
		await expect(
			db.query(
				`INSERT INTO content_reports(reporter_id,target_type,target_id,reason,idempotency_key)
			VALUES($1,'trip_review',$2,'Thông tin đường đi chưa chính xác.',$3)`,
				[camper.id, reviewId, randomUUID()]
			)
		).rejects.toMatchObject({ driverError: { code: "23514" } });
	});
	it.each(["registered", "left", "removed", "no_show"])(
		"rejects inactive membership %s",
		async (status) => {
			await db.query("UPDATE booking_members SET member_status=$2 WHERE id=$1", [memberId, status]);
			await submit(body()).expect(404);
		}
	);
	it("rejects left_at even if status still says joined", async () => {
		await db.query("UPDATE booking_members SET left_at=now() WHERE id=$1", [memberId]);
		await submit(body()).expect(404);
	});
	it("hides missing, unauthorized and self-report targets identically", async () => {
		const missing = await submit({ ...body(), targetId: randomUUID() }).expect(404);
		await db.query("UPDATE trip_reviews SET reviewer_id=$2 WHERE id=$1", [reviewId, host.id]);
		const unauthorized = await submit(body(), admin).expect(404);
		await db.query("UPDATE trip_reviews SET reviewer_id=$2 WHERE id=$1", [reviewId, camper.id]);
		const self = await submit(body()).expect(404);
		expect(self.body).toEqual(missing.body);
		expect(unauthorized.body).toEqual(missing.body);
	});
	it("does not trust Host claims from a Camper token", async () => {
		await db.query("UPDATE booking_members SET member_status='left',left_at=now() WHERE id=$1", [
			memberId,
		]);
		const forgedRoles = jwt.sign({ sub: camper.id, roles: [UserRole.HOST, UserRole.ADMIN] });
		await request(app.getHttpServer())
			.post("/api/me/content-reports")
			.set("Authorization", `Bearer ${forgedRoles}`)
			.send(body())
			.expect(404);
	});
	it("hides reports submitted by a different Host from my list", async () => {
		await submit(body(), host).expect(200);
		const list = await request(app.getHttpServer())
			.get("/api/me/content-reports")
			.set("Authorization", auth())
			.expect(200);
		expect(list.body.items).toEqual([]);
	});
	it("rejects simultaneous changed payloads on the same key", async () => {
		const payload = body();
		const results = await Promise.all([
			submit(payload),
			submit({ ...payload, description: "Mô tả vị trí đoạn đường không chính xác." }),
		]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
		expect(results.find((result) => result.status === 409)?.body.code).toBe(
			"REPORT_IDEMPOTENCY_CONFLICT"
		);
		expect(await reports()).toHaveLength(1);
	});
	it("returns the same record for simultaneous retries and only audits once", async () => {
		const payload = body();
		const results = await Promise.all([submit(payload), submit(payload), submit(payload)]);
		expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
		expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
		expect(await reports()).toHaveLength(1);
		expect(await audits()).toHaveLength(1);
	});
	it("distinguishes changed content on the same key", async () => {
		const payload = body();
		await submit(payload).expect(200);
		const result = await submit({
			...payload,
			description: "Thông tin mô tả không chính xác.",
		}).expect(409);
		expect(result.body.code).toBe("REPORT_IDEMPOTENCY_CONFLICT");
	});
	it("uses the database to block simultaneous different keys on the same target", async () => {
		const results = await Promise.all([submit(body()), submit(body())]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
		expect(results.find((result) => result.status === 409)?.body.code).toBe("REPORT_ALREADY_OPEN");
		expect(await reports()).toHaveLength(1);
	});
	it.each(["pending", "reviewing"])("blocks a new key while %s", async (status) => {
		const result = await submit(body()).expect(200);
		await db.query("UPDATE content_reports SET status=$2 WHERE id=$1", [result.body.id, status]);
		expect((await submit(body()).expect(409)).body.code).toBe("REPORT_ALREADY_OPEN");
	});
	it.each(["actioned", "rejected"])(
		"allows a new report after %s and replays old keys after membership ends",
		async (status) => {
			const payload = body();
			const first = await submit(payload).expect(200);
			await db.query("UPDATE content_reports SET status=$2 WHERE id=$1", [first.body.id, status]);
			await submit(body()).expect(200);
			await db.query("UPDATE booking_members SET member_status='left',left_at=now() WHERE id=$1", [
				memberId,
			]);
			expect((await submit(payload).expect(200)).body).toMatchObject({ id: first.body.id, status });
			await submit(body()).expect(404);
		}
	);
	it("paginates only own reports", async () => {
		await submit(body()).expect(200);
		await submit(body(), host).expect(200);
		const list = await request(app.getHttpServer())
			.get("/api/me/content-reports?page=1&limit=1")
			.set("Authorization", auth())
			.expect(200);
		expect(list.body.items).toHaveLength(1);
		expect(list.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
	});
	it("requires login and rejects spoofed identity/status and unsupported targets", async () => {
		await request(app.getHttpServer()).post("/api/me/content-reports").send(body()).expect(401);
		for (const override of [
			{ reporterId: host.id },
			{ status: "actioned" },
			{ targetType: "ai_answer" },
			{ reportType: "other" },
			{ description: " " },
		]) {
			await submit({ ...body(), ...override }).expect(422);
		}
		expect(await reports()).toHaveLength(0);
	});
	it("rolls back the report when audit insertion fails", async () => {
		await db.query(
			`CREATE FUNCTION ctms391_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CTMS391 audit rollback fixture'; END; $$`
		);
		try {
			await db.query(
				`CREATE TRIGGER ctms391_reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action='content_report.created') EXECUTE FUNCTION ctms391_reject_audit()`
			);
			await submit(body()).expect(500);
			expect(await reports()).toHaveLength(0);
		} finally {
			await db.query("DROP TRIGGER IF EXISTS ctms391_reject_audit ON audit_logs");
			await db.query("DROP FUNCTION ctms391_reject_audit()");
		}
	});
	it("migrates a legacy report without changing identity, reason, state or timestamps", async () => {
		const runner = db.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		try {
			const migration = new AddContentReportSubmission1796200000000();
			await migration.down(runner);
			await runner.query(
				"INSERT INTO content_reports(id,reporter_id,target_type,target_id,reason,status) VALUES($1,$2,'review',$3,'Thông tin đường đi cần được kiểm tra.','reviewing')",
				[legacyId, camper.id, reviewId]
			);
			const [before] = await runner.query("SELECT * FROM content_reports WHERE id=$1", [legacyId]);
			await migration.up(runner);
			const [after] = await runner.query("SELECT * FROM content_reports WHERE id=$1", [legacyId]);
			expect(after).toEqual({
				...before,
				report_type: null,
				idempotency_key: null,
				request_hash: null,
			});
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
		}
	});
	it("does not mutate review content or moderation state", async () => {
		const [before] = await db.query("SELECT * FROM trip_reviews WHERE id=$1", [reviewId]);
		await submit(body()).expect(200);
		const [after] = await db.query("SELECT * FROM trip_reviews WHERE id=$1", [reviewId]);
		expect(after).toEqual(before);
		expect(await db.getRepository(ContentReport).countBy({ targetId: reviewId })).toBe(1);
	});
});
