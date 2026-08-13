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

describe("Admin user accounts (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let admin: TestAccount;
	let camper: TestAccount;
	let cleanupUserIds: string[] = [];
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
		admin = await createAccount("admin", "active", "Admin CTMS");
		camper = await createAccount("camper", "active", "Nguyen Camper");
	});

	afterEach(async () => {
		if (cleanupUserIds.length === 0) return;
		await dataSource.query(
			'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
			[cleanupUserIds]
		);
		await dataSource.query('DELETE FROM "emergency_contacts" WHERE "user_id" = ANY($1)', [
			cleanupUserIds,
		]);
		await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
			cleanupUserIds,
		]);
		await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
			cleanupUserIds,
		]);
		await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
	});

	async function createAccount(
		role: "admin" | "camper",
		status: "active" | "suspended",
		fullName: string,
		grantedRoles: Array<"admin" | "camper"> = [role]
	): Promise<TestAccount> {
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const email = `e2e-users-${role}-${sequence}@example.com`;
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

	it("requires authentication and current Admin role", async () => {
		await request(app.getHttpServer()).get("/api/users").expect(401);
		await request(app.getHttpServer())
			.get("/api/users")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(403);
	});

	it("allows granted multi-role Admin accounts and rejects manipulated JWT role claims", async () => {
		const camperAdmin = await createAccount("camper", "active", "Camper Admin", [
			"camper",
			"admin",
		]);
		await request(app.getHttpServer())
			.get("/api/users")
			.set("Authorization", `Bearer ${camperAdmin.accessToken}`)
			.expect(200);

		const forgedAdminToken = jwtService.sign({ sub: camper.id, roles: ["camper", "admin"] });
		await request(app.getHttpServer())
			.get("/api/users")
			.set("Authorization", `Bearer ${forgedAdminToken}`)
			.expect(403);
	});

	it("searches, filters, paginates, and never exposes passwordHash", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/users")
			.query({ search: "Nguyen Camper", role: "camper", status: "active", page: 1, limit: 20 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			id: camper.id,
			role: "camper",
			status: "active",
		});
		expect(response.body.items[0].passwordHash).toBeUndefined();
		expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });

		await request(app.getHttpServer())
			.get("/api/users")
			.query({ page: 0, limit: 101 })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(422);
		await request(app.getHttpServer())
			.get("/api/users/not-a-uuid")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(422);
	});

	it("returns whitelisted user details", async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/users/${camper.id}`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(response.body).toMatchObject({ id: camper.id, fullName: "Nguyen Camper" });
		expect(response.body.passwordHash).toBeUndefined();
	});

	it("locks and unlocks transactionally while preserving related data and audit history", async () => {
		await dataSource.query(
			`INSERT INTO "refresh_tokens" ("user_id", "token_hash", "expires_at") VALUES ($1, $2, now() + interval '1 day')`,
			[camper.id, `hash-${camper.id}`]
		);
		await dataSource.query(
			`INSERT INTO "emergency_contacts" ("user_id", "name", "relationship", "phone") VALUES ($1, 'Relative', 'friend', '+84911111111')`,
			[camper.id]
		);

		await request(app.getHttpServer())
			.patch(`/api/users/${camper.id}/lock`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ reason: "Security review" })
			.expect(200)
			.expect(({ body }) => expect(body.status).toBe("suspended"));

		await request(app.getHttpServer())
			.patch(`/api/users/${camper.id}/lock`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({})
			.expect(409);
		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: camper.email, password })
			.expect(401);
		await request(app.getHttpServer())
			.get("/api/profiles/me")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(401);

		const tokens = await dataSource.query(
			'SELECT "revoked_at" FROM "refresh_tokens" WHERE "user_id" = $1',
			[camper.id]
		);
		expect(tokens[0].revoked_at).toBeTruthy();
		const contacts = await dataSource.query(
			'SELECT "id" FROM "emergency_contacts" WHERE "user_id" = $1',
			[camper.id]
		);
		expect(contacts).toHaveLength(1);
		const lockAudits = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[camper.id, "user.account_locked"]
		);
		expect(lockAudits).toHaveLength(1);
		expect(lockAudits[0].reason).toBe("Security review");

		await request(app.getHttpServer())
			.patch(`/api/users/${camper.id}/unlock`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({})
			.expect(200)
			.expect(({ body }) => expect(body.status).toBe("active"));
		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: camper.email, password })
			.expect(200);
		const unlockAudits = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[camper.id, "user.account_unlocked"]
		);
		expect(unlockAudits).toHaveLength(1);
	});

	it("does not allow an Admin to lock their own account", async () => {
		await request(app.getHttpServer())
			.patch(`/api/users/${admin.id}/lock`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({})
			.expect(409);
	});
});
