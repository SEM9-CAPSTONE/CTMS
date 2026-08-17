import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("POST /api/auth/login (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let authService: AuthService;
	let cleanupEmails: string[];
	let cleanupPhones: string[];
	let cleanupUserIds: string[];
	let phoneSeq = 0;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

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
		authService = moduleRef.get(AuthService);
		expect(dataSource.isInitialized).toBe(true);
	});

	afterAll(async () => {
		const leftover = await dataSource.query(
			"SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'e2e-%'"
		);
		expect(leftover[0].count).toBe(0);

		await app.close();
	});

	beforeEach(() => {
		cleanupEmails = [];
		cleanupPhones = [];
		cleanupUserIds = [];
	});

	afterEach(async () => {
		// FK order: refresh_tokens/verification_otps -> users.
		if (cleanupUserIds?.length) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
		}
		if (cleanupEmails?.length) {
			await dataSource.query('DELETE FROM "users" WHERE "email" = ANY($1)', [cleanupEmails]);
		}
		if (cleanupPhones?.length) {
			await dataSource.query('DELETE FROM "users" WHERE "phone" = ANY($1)', [cleanupPhones]);
		}
	});

	function uniqueEmail(tag: string): string {
		return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
	}

	function uniqueLocalPhone(): string {
		phoneSeq += 1;
		return `09${String(10000000 + phoneSeq).padStart(8, "0")}`;
	}

	const PASSWORD = "S3curePass!";

	/** Registers and fully activates a real user through the real HTTP
	 * endpoints (register -> issueOtp in-process, same pattern as
	 * auth.verify-otp.integration-spec.ts -> verify over HTTP). */
	async function registerAndActivateUser(
		tag: string
	): Promise<{ userId: string; email: string; localPhone: string }> {
		const email = uniqueEmail(tag);
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: PASSWORD, role: "camper" })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		const code = await authService.issueOtp(userId);
		await request(app.getHttpServer()).post("/api/auth/verify").send({ userId, code }).expect(200);

		return { userId, email, localPhone: local };
	}

	// --- Success, login by email (AC1, BR-009) --------------------------------

	it("returns access token, refresh token, and user profile when logging in by email", async () => {
		const { userId, email } = await registerAndActivateUser("login-email");

		const response = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);

		expect(response.body.accessToken).toEqual(expect.any(String));
		expect(response.body.refreshToken).toEqual(expect.any(String));
		expect(response.body.user).toMatchObject({ id: userId, email, status: "active" });

		const rows = await dataSource.query(
			'SELECT "token_hash" FROM "refresh_tokens" WHERE "user_id" = $1',
			[userId]
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].token_hash).not.toBe(response.body.refreshToken); // never stored raw

		// Assert on audit logs
		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "actor_id" = $1 AND "action" = $2',
			[userId, "auth.login"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].target_type).toBe("user");
		expect(auditRows[0].target_id).toBe(userId);
		expect(auditRows[0].before).toBeNull();
		expect(auditRows[0].after).toBeNull();
	});

	// --- Success, login by phone (Tech Lead review: prove findByEmailOrPhone reuse) --

	it("returns access token, refresh token, and user profile when logging in by phone", async () => {
		const { userId, localPhone } = await registerAndActivateUser("login-phone");

		const response = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: localPhone, password: PASSWORD })
			.expect(200);

		expect(response.body.accessToken).toEqual(expect.any(String));
		expect(response.body.refreshToken).toEqual(expect.any(String));
		expect(response.body.user).toMatchObject({ id: userId, status: "active" });
	});

	// --- Wrong password (AC2, BR-010) -----------------------------------------

	it("returns 401 and creates no refresh token when the password is wrong", async () => {
		const { userId, email } = await registerAndActivateUser("login-wrong-password");

		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: "wrong-password" })
			.expect(401);

		const rows = await dataSource.query('SELECT * FROM "refresh_tokens" WHERE "user_id" = $1', [
			userId,
		]);
		expect(rows).toHaveLength(0);
	});

	// --- Unknown identifier (AC2, BR-010) --------------------------------------

	it("returns 401 for an identifier that matches no account", async () => {
		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: uniqueEmail("login-unknown"), password: PASSWORD })
			.expect(401);
	});

	// --- Non-active accounts (AC3, BR-202) --------------------------------------

	it("returns 401 when the account is still pending_verification (never completed OTP verify)", async () => {
		const email = uniqueEmail("login-pending");
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: PASSWORD, role: "camper" })
			.expect(201);
		cleanupUserIds.push(registerResponse.body.id);

		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(401);
	});

	it("returns 401 when the account is suspended", async () => {
		const { userId, email } = await registerAndActivateUser("login-suspended");
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
			"suspended",
			userId,
		]);

		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(401);
	});

	it("returns 401 when the account is deleted", async () => {
		const { userId, email } = await registerAndActivateUser("login-deleted");
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', ["deleted", userId]);

		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(401);
	});

	// --- Validation (422, BR-205) -----------------------------------------------

	it("rejects a missing password with 422", async () => {
		const { email } = await registerAndActivateUser("login-missing-password");

		const response = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	it("rejects a missing identifier with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ password: PASSWORD })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});
});
