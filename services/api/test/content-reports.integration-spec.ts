import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuditLog } from "../src/modules/auth/entities/audit-log.entity";
import { ContentReportStatus as Status } from "../src/modules/content-reports/content-report-status.enum";
import { ContentReport } from "../src/modules/content-reports/entities/content-report.entity";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("Content reports (real PostgreSQL integration)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let admin: User;
	let camper: User;
	let report: ContentReport;
	let userIds: string[];

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
	});
	afterAll(async () => {
		await app?.close();
	});
	beforeEach(async () => {
		userIds = [];
		admin = await account(UserRole.ADMIN);
		camper = await account(UserRole.CAMPER);
		report = await db.getRepository(ContentReport).save(
			db.getRepository(ContentReport).create({
				reporterId: camper.id,
				targetType: "  test-owned-domain  ",
				targetId: randomUUID(),
				reason: "  Report reason  ",
			})
		);
	});
	afterEach(async () => {
		if (!db || !userIds?.length) return;
		await db.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1::uuid[])', [userIds]);
		await db.query('DELETE FROM "content_reports" WHERE "reporter_id" = ANY($1::uuid[])', [
			userIds,
		]);
		await db.query('DELETE FROM "users" WHERE "id" = ANY($1::uuid[])', [userIds]);
	});

	async function account(role: UserRole): Promise<User> {
		const user = await db.getRepository(User).save(
			db.getRepository(User).create({
				email: `ctms105-${randomUUID()}@example.com`,
				passwordHash: "unused-test-secret",
				role,
				status: UserStatus.ACTIVE,
				fullName: "Report test account",
			})
		);
		userIds.push(user.id);
		await db.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [user.id, role]);
		return user;
	}
	const authorization = (user: User) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;
	const read = (id = report.id) =>
		request(app.getHttpServer())
			.get(`/api/content-reports/${id}`)
			.set("Authorization", authorization(admin));
	const transition = (
		status: Status,
		expectedStatus = Status.PENDING,
		actor = admin,
		id = report.id
	) =>
		request(app.getHttpServer())
			.patch(`/api/content-reports/${id}/status`)
			.set("Authorization", authorization(actor))
			.send({ expectedStatus, status });
	const persisted = () => db.getRepository(ContentReport).findOneByOrFail({ id: report.id });
	const audits = () =>
		db.getRepository(AuditLog).findBy({ targetType: "content_report", targetId: report.id });

	it("requires authentication and current Admin role on both endpoints", async () => {
		await request(app.getHttpServer()).get(`/api/content-reports/${report.id}`).expect(401);
		await request(app.getHttpServer())
			.patch(`/api/content-reports/${report.id}/status`)
			.send({ expectedStatus: Status.PENDING, status: Status.ACTIONED })
			.expect(401);
		await request(app.getHttpServer())
			.get(`/api/content-reports/${report.id}`)
			.set("Authorization", authorization(camper))
			.expect(403);
		await transition(Status.ACTIONED, Status.PENDING, camper).expect(403);
		const forgedRole = jwt.sign({ sub: camper.id, roles: [UserRole.ADMIN] });
		await request(app.getHttpServer())
			.get(`/api/content-reports/${report.id}`)
			.set("Authorization", `Bearer ${forgedRole}`)
			.expect(403);
		expect((await persisted()).status).toBe(Status.PENDING);
		expect(await audits()).toHaveLength(0);
	});
	it("returns authoritative data with safe reporter identity and normalized strings", async () => {
		const response = await read().expect(200);
		expect(response.body).toEqual({
			id: report.id,
			reporter: { id: camper.id, fullName: camper.fullName },
			targetType: "test-owned-domain",
			targetId: report.targetId,
			reason: "Report reason",
			status: Status.PENDING,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
	});
	it.each([Status.REVIEWING, Status.ACTIONED, Status.REJECTED])(
		"persists pending -> %s with exactly one audit and no target lookup",
		async (status) => {
			const before = await persisted();
			const actorBefore = await db.getRepository(User).findOneByOrFail({ id: admin.id });
			const response = await transition(status).expect(200);
			expect(response.body.status).toBe(status);
			const after = await persisted();
			expect(after).toMatchObject({ ...before, status, updatedAt: expect.any(Date) });
			expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
			const history = await audits();
			expect(history).toHaveLength(1);
			expect(history[0]).toMatchObject({
				actorId: admin.id,
				targetType: "content_report",
				targetId: report.id,
				action: "content_report.status_changed",
				before: { status: Status.PENDING },
				after: { status },
				reason: null,
			});
			expect(await db.getRepository(User).findOneByOrFail({ id: admin.id })).toEqual(actorBefore);
			// targetId is deliberately nonexistent: handling cannot require target existence.
		}
	);
	it("rejects stale requests and preserves successful history", async () => {
		await transition(Status.REVIEWING).expect(200);
		const before = await persisted();
		await transition(Status.ACTIONED).expect(409);
		expect(await persisted()).toEqual(before);
		expect(await audits()).toHaveLength(1);
	});
	const invalidPairs = Object.values(Status).flatMap((from) =>
		Object.values(Status)
			.filter((to) => from !== Status.PENDING || to === Status.PENDING)
			.map((to) => [from, to] as const)
	);
	it.each(invalidPairs)(
		"rejects invalid %s -> %s without state/audit changes",
		async (from, to) => {
			await db.getRepository(ContentReport).update(report.id, { status: from });
			const before = await persisted();
			await transition(to, from).expect(409);
			expect(await persisted()).toEqual(before);
			expect(await audits()).toHaveLength(0);
		}
	);
	it("returns 404 for nonexistent report and 422 for malformed ID", async () => {
		await read(randomUUID()).expect(404);
		await transition(Status.REVIEWING, Status.PENDING, admin, randomUUID()).expect(404);
		await read("invalid-id").expect(422);
	});
	it.each([
		"reporter",
		"reporterId",
		"reporter_id",
		"targetType",
		"target_type",
		"targetId",
		"target_id",
		"reason",
		"actorId",
	])("rejects body override %s without mutation", async (field) => {
		await request(app.getHttpServer())
			.patch(`/api/content-reports/${report.id}/status`)
			.set("Authorization", authorization(admin))
			.send({ expectedStatus: Status.PENDING, status: Status.ACTIONED, [field]: "override" })
			.expect(422);
		expect((await persisted()).status).toBe(Status.PENDING);
		expect(await audits()).toHaveLength(0);
	});
	it.each([
		{ status: "unknown", expectedStatus: Status.PENDING },
		{ status: Status.ACTIONED },
		{ status: null, expectedStatus: Status.PENDING },
	])("rejects malformed transition body %p", async (body) => {
		await request(app.getHttpServer())
			.patch(`/api/content-reports/${report.id}/status`)
			.set("Authorization", authorization(admin))
			.send(body)
			.expect(422);
		expect((await persisted()).status).toBe(Status.PENDING);
	});
	it("serializes concurrent Admin decisions; exactly one succeeds and is audited", async () => {
		const otherAdmin = await account(UserRole.ADMIN);
		const results = await Promise.all([
			transition(Status.REVIEWING),
			transition(Status.ACTIONED, Status.PENDING, otherAdmin),
		]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
		const winner = results.find((result) => result.status === 200);
		expect(winner).toBeDefined();
		expect((await persisted()).status).toBe(winner?.body.status);
		expect(await audits()).toHaveLength(1);
	});
	it("rolls back report status and timestamp when PostgreSQL rejects the audit insert", async () => {
		const before = await persisted();
		// Real DB failure, scoped to this report; no mock transaction or repository.
		await db.query(
			`CREATE FUNCTION ctms105_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CTMS105 test audit failure'; END; $$`
		);
		try {
			await db.query(
				`CREATE TRIGGER ctms105_test_reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.target_id = '${report.id}'::uuid) EXECUTE FUNCTION ctms105_test_reject_audit()`
			);
			await transition(Status.ACTIONED).expect(500);
			expect(await persisted()).toEqual(before);
			expect(await audits()).toHaveLength(0);
		} finally {
			await db.query("DROP TRIGGER IF EXISTS ctms105_test_reject_audit ON audit_logs");
			await db.query("DROP FUNCTION ctms105_test_reject_audit()");
		}
	});
	it.each([
		{ targetType: " " },
		{ targetType: "\t\n" },
		{ targetType: "x".repeat(101) },
		{ reason: " " },
		{ reason: "\t\n" },
		{ reason: "x".repeat(1001) },
		{ reporterId: randomUUID() },
	])("enforces persistence constraints for %p", async (override) => {
		const repository = db.getRepository(ContentReport);
		await expect(
			repository.save(
				repository.create({
					reporterId: camper.id,
					targetType: "test-domain",
					targetId: randomUUID(),
					reason: "reason",
					...override,
				})
			)
		).rejects.toThrow();
	});
	it("prevents deleting the reporter while report history still references the user", async () => {
		await expect(db.getRepository(User).delete(camper.id)).rejects.toThrow();
		expect(await persisted()).toBeDefined();
	});
});
