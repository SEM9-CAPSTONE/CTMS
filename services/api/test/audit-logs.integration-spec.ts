import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	email: string;
	accessToken: string;
}

describe("Audit logs administration (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let admin: TestAccount;
	let camper: TestAccount;
	let cleanupUserIds: string[] = [];
	let cleanupLogIds: string[] = [];
	const password = "S3curePass!";

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
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(async () => {
		cleanupUserIds = [];
		cleanupLogIds = [];
		admin = await createAccount("admin", "active", "Admin CTMS");
		camper = await createAccount("camper", "active", "Nguyen Camper");
	});

	afterEach(async () => {
		if (cleanupLogIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "id" = ANY($1)', [cleanupLogIds]);
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
		}
	});

	async function createAccount(
		role: "admin" | "camper",
		status: "active" | "suspended",
		fullName: string,
		grantedRoles: Array<"admin" | "camper"> = [role]
	): Promise<TestAccount> {
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const email = `e2e-audit-${role}-${sequence}@example.com`;
		const passwordHash = await hash(password, 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, fullName]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		for (const grantedRole of grantedRoles) {
			await dataSource.query(
				`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
				 ON CONFLICT ("user_id", "role") DO NOTHING`,
				[id, grantedRole]
			);
		}
		cleanupUserIds.push(id);
		return { id, email, accessToken: jwtService.sign({ sub: id, roles: grantedRoles }) };
	}

	async function createAuditLog(
		actorId: string | null,
		action: string,
		targetType: string,
		targetId: string,
		before: Record<string, unknown> | null = null,
		after: Record<string, unknown> | null = null,
		reason: string | null = null,
		createdAt: Date = new Date()
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason", "created_at")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
			[
				actorId,
				action,
				targetType,
				targetId,
				before ? JSON.stringify(before) : null,
				after ? JSON.stringify(after) : null,
				reason,
				createdAt,
			]
		)) as Array<{ id: string }>;
		const logId = rows[0].id;
		cleanupLogIds.push(logId);
		return logId;
	}

	it("requires authentication and current Admin role", async () => {
		await request(app.getHttpServer()).get("/api/audit-logs").expect(401);

		await request(app.getHttpServer())
			.get("/api/audit-logs")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(403);

		const suspendedAdmin = await createAccount("admin", "suspended", "Suspended Admin");
		await request(app.getHttpServer())
			.get("/api/audit-logs")
			.set("Authorization", `Bearer ${suspendedAdmin.accessToken}`)
			.expect(401);
	});

	it("filters audit logs by actor, action, target, targetType, outcome, and time range", async () => {
		const targetUser1 = camper.id;
		const targetUser2 = admin.id;

		const log1 = await createAuditLog(
			admin.id,
			"auth.register",
			"user",
			targetUser1,
			null,
			{ role: "camper" },
			"New user",
			new Date("2026-08-01T08:00:00Z")
		);

		const log2 = await createAuditLog(
			camper.id,
			"user.account_locked",
			"user",
			targetUser2,
			{ status: "active" },
			{ status: "suspended" },
			"Inappropriate behavior",
			new Date("2026-08-05T09:00:00Z")
		);

		const log3 = await createAuditLog(
			null,
			"auth.login",
			"user",
			targetUser1,
			null,
			null,
			null,
			new Date("2026-08-10T10:00:00Z")
		);

		// 1. Filter by actorId / actor
		let res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ actorId: admin.id })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log1);

		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ actor: camper.id })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log2);

		// 2. Filter by action
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ action: "auth.login" })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log3);

		// 3. Filter by targetId / target
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ targetId: targetUser1 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(2);

		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ target: targetUser2 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log2);

		// 4. Filter by targetType
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ targetType: "user" })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items.length).toBeGreaterThanOrEqual(3);

		// 5. Filter by time range
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({
				startDate: "2026-08-03T00:00:00Z",
				endDate: "2026-08-07T00:00:00Z",
			})
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log2);

		// 6. Filter by outcome
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ outcome: "success" })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items.length).toBeGreaterThanOrEqual(3);

		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ outcome: "failure" })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(res.body.items).toHaveLength(0);
		expect(res.body.pagination.total).toBe(0);
	});

	it("verifies pagination and stable ordering", async () => {
		const targetId = camper.id;

		const log1 = await createAuditLog(
			admin.id,
			"auth.register",
			"user",
			targetId,
			null,
			null,
			"Log 1",
			new Date("2026-08-01T10:00:00Z")
		);
		const log2 = await createAuditLog(
			admin.id,
			"auth.register",
			"user",
			targetId,
			null,
			null,
			"Log 2",
			new Date("2026-08-02T10:00:00Z")
		);
		const log3 = await createAuditLog(
			admin.id,
			"auth.register",
			"user",
			targetId,
			null,
			null,
			"Log 3",
			new Date("2026-08-03T10:00:00Z")
		);

		// Request page 1 with limit 2 (should return log3 and log2 in descending order)
		let res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ targetId, page: 1, limit: 2 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(res.body.items).toHaveLength(2);
		expect(res.body.items[0].id).toBe(log3);
		expect(res.body.items[1].id).toBe(log2);
		expect(res.body.pagination).toEqual({
			page: 1,
			limit: 2,
			total: 3,
			totalPages: 2,
		});

		// Request page 2 with limit 2 (should return log1)
		res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ targetId, page: 2, limit: 2 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(res.body.items).toHaveLength(1);
		expect(res.body.items[0].id).toBe(log1);
	});

	it("verifies sensitive fields are masked in responses", async () => {
		const targetId = camper.id;
		await createAuditLog(
			admin.id,
			"auth.register",
			"user",
			targetId,
			{ password: "myPassword", passwordHash: "secret-hash", someNormalField: "hello" },
			{ codeHash: "code123", tokenHash: "token123", anotherField: "world" },
			"Testing masking"
		);

		const res = await request(app.getHttpServer())
			.get("/api/audit-logs")
			.query({ targetId, limit: 1 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(res.body.items).toHaveLength(1);
		const item = res.body.items[0];
		expect(item.before).toEqual({
			password: "[MASKED]",
			passwordHash: "[MASKED]",
			someNormalField: "hello",
		});
		expect(item.after).toEqual({
			codeHash: "[MASKED]",
			tokenHash: "[MASKED]",
			anotherField: "world",
		});
	});
});
