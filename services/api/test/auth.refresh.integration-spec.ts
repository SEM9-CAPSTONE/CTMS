import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
// biome-ignore lint/style/useImportType: resolved from the DI container at runtime (moduleRef.get), needs design:paramtypes metadata
import { AuthService } from "../src/modules/auth/auth.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

/**
 * CTMS-04-T01, real Postgres, no mocking -- same pattern as
 * auth.login.integration-spec.ts. Covers the Jira Test Checklist directly:
 * valid refresh, expired/revoked rejection, rotation, reuse-of-invalidated-
 * token, session revocation (via an existing revoke path), and the DG-03
 * concurrent-refresh guard.
 */
describe("POST /api/auth/refresh (integration, real Postgres)", () => {
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
		// FK order: refresh_tokens/verification_otps/audit_logs -> users.
		if (cleanupUserIds.length > 0) {
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [
				cleanupUserIds,
			]);
		}
		if (cleanupEmails.length > 0) {
			await dataSource.query('DELETE FROM "users" WHERE "email" = ANY($1)', [cleanupEmails]);
		}
		if (cleanupPhones.length > 0) {
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

	/** Registers, activates, and logs a real user in through the real HTTP
	 * endpoints -- returns a genuine, currently-valid refresh token, same
	 * as any real client would receive. */
	async function registerAndLogin(
		tag: string
	): Promise<{ userId: string; email: string; refreshToken: string }> {
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

		const loginResponse = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);

		return { userId, email, refreshToken: loginResponse.body.refreshToken };
	}

	// --- Success path (AC1, BR-012) ---------------------------------------------

	it("returns a new access token and a rotated refresh token for a valid refresh token", async () => {
		const { userId, refreshToken } = await registerAndLogin("refresh-valid");

		const response = await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken })
			.expect(200);

		expect(response.body.accessToken).toEqual(expect.any(String));
		expect(response.body.refreshToken).toEqual(expect.any(String));
		expect(response.body.refreshToken).not.toBe(refreshToken); // DG-02: rotation, never the same value back
		expect(response.body).not.toHaveProperty("user"); // DG-01

		const rows = await dataSource.query(
			'SELECT "token_hash", "revoked_at" FROM "refresh_tokens" WHERE "user_id" = $1 ORDER BY "created_at"',
			[userId]
		);
		expect(rows).toHaveLength(2); // old (revoked) + new (active)
		expect(rows[0].revoked_at).not.toBeNull();
		expect(rows[1].revoked_at).toBeNull();
	});

	// --- DG-05/BR-200: audit log ------------------------------------------------

	it("writes an audit-log row for a successful refresh", async () => {
		const { userId, refreshToken } = await registerAndLogin("refresh-audit");

		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(200);

		const rows = await dataSource.query('SELECT "action" FROM "audit_logs" WHERE "actor_id" = $1', [
			userId,
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].action).toBe("auth.token_refreshed");
	});

	// --- DG-02: rotation + DG-03: reuse of the old (now-invalidated) token ------

	it("rejects the old refresh token once it has been rotated (prevent reuse of an invalidated token)", async () => {
		const { refreshToken } = await registerAndLogin("refresh-reuse");

		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(200);

		// Same (now-rotated) token used again -> must be rejected, not silently
		// accepted a second time.
		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
	});

	// --- DG-03: concurrent duplicate refresh -------------------------------------

	it("lets exactly one of two concurrent requests with the same refresh token succeed", async () => {
		const { userId, refreshToken } = await registerAndLogin("refresh-concurrent");

		const [first, second] = await Promise.all([
			request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }),
			request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }),
		]);

		const statuses = [first.status, second.status].sort();
		expect(statuses).toEqual([200, 401]);

		// Exactly 1 new active row was created, not 2 -- the loser did not
		// also mint a token before losing the race.
		const activeRows = await dataSource.query(
			'SELECT COUNT(*)::int AS count FROM "refresh_tokens" WHERE "user_id" = $1 AND "revoked_at" IS NULL',
			[userId]
		);
		expect(activeRows[0].count).toBe(1);
	});

	// --- AC2: expired / revoked ---------------------------------------------------

	it("returns 401 for an expired refresh token", async () => {
		const { userId, refreshToken } = await registerAndLogin("refresh-expired");
		await dataSource.query(
			'UPDATE "refresh_tokens" SET "expires_at" = NOW() - INTERVAL \'1 minute\' WHERE "user_id" = $1',
			[userId]
		);

		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
	});

	it("returns 401 for a refresh token revoked by another flow (session revocation, DG-04)", async () => {
		const { userId, email, refreshToken } = await registerAndLogin("refresh-revoked");

		// Reuses the existing revocation path (resetPassword's
		// revokeActiveTokensForUser) rather than inventing a new one --
		// exactly DG-04's confirmed interpretation of "session revocation".
		const otpCode = await authService.issueOtp(userId);
		await request(app.getHttpServer())
			.post("/api/auth/reset-password")
			.send({ identifier: email, code: otpCode, newPassword: "AnotherPass1!" })
			.expect(200);

		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
	});

	it("returns 401 for a refresh token that never existed", async () => {
		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: "not-a-real-token" })
			.expect(401);
	});

	// --- BR-201/BR-202: account status re-check ----------------------------------

	it("returns 401 when the account has been suspended since the token was issued", async () => {
		const { userId, refreshToken } = await registerAndLogin("refresh-suspended");
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
			"suspended",
			userId,
		]);

		await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
	});

	// --- Validation (422, BR-205) --------------------------------------------------

	it("rejects a missing refreshToken with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({})
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});
});
