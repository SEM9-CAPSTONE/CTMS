import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import {
	EMAIL_OTP_PROVIDER,
	type OtpNotificationProvider,
	SMS_OTP_PROVIDER,
} from "../src/modules/auth/providers/otp-notification-provider.interface";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

jest.setTimeout(60_000);

function buildFakeProvider(): jest.Mocked<OtpNotificationProvider> {
	return { send: jest.fn().mockResolvedValue(undefined) };
}

describe("POST /api/auth/forgot-password + /reset-password (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let authService: AuthService;
	let cleanupEmails: string[] = [];
	let cleanupPhones: string[] = [];
	let cleanupUserIds: string[] = [];
	let phoneSeq = 0;
	let fakeSmsProvider: jest.Mocked<OtpNotificationProvider>;
	let fakeEmailProvider: jest.Mocked<OtpNotificationProvider>;

	const PASSWORD = "OldPassword1";
	const NEW_PASSWORD = "NewPassword1";

	beforeAll(async () => {
		process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
		process.env.JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL ?? "15m";
		process.env.JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL ?? "7d";
		process.env.OTP_TTL_MINUTES = process.env.OTP_TTL_MINUTES ?? "10";
		process.env.OTP_RESEND_MAX_ATTEMPTS = process.env.OTP_RESEND_MAX_ATTEMPTS ?? "5";
		process.env.OTP_RESEND_WINDOW_MINUTES = process.env.OTP_RESEND_WINDOW_MINUTES ?? "1440";

		fakeSmsProvider = buildFakeProvider();
		fakeEmailProvider = buildFakeProvider();

		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(SMS_OTP_PROVIDER)
			.useValue(fakeSmsProvider)
			.overrideProvider(EMAIL_OTP_PROVIDER)
			.useValue(fakeEmailProvider)
			.compile();

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
		if (dataSource?.isInitialized) {
			const leftover = await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'e2e-%'"
			);
			expect(leftover[0].count).toBe(0);
		}

		await app?.close();
	});

	beforeEach(() => {
		cleanupEmails = [];
		cleanupPhones = [];
		cleanupUserIds = [];
		fakeSmsProvider.send.mockClear().mockResolvedValue(undefined);
		fakeEmailProvider.send.mockClear().mockResolvedValue(undefined);
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) {
			return;
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[cleanupUserIds]
			);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
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

	async function registerAndActivateUser(
		tag: string
	): Promise<{ userId: string; email: string; localPhone: string }> {
		const email = uniqueEmail(tag);
		const localPhone = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${localPhone.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: localPhone, password: PASSWORD, role: "camper" })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		const code = await authService.issueOtp(userId);
		await request(app.getHttpServer()).post("/api/auth/verify").send({ userId, code }).expect(200);

		return { userId, email, localPhone };
	}

	it("requests a reset OTP without exposing the code", async () => {
		const { userId, email } = await registerAndActivateUser("forgot-password");

		const response = await request(app.getHttpServer())
			.post("/api/auth/forgot-password")
			.send({ identifier: email, channel: "email" })
			.expect(200);

		expect(response.body).toEqual({ requestAccepted: true });
		expect(JSON.stringify(response.body)).not.toMatch(/code/i);
		expect(fakeEmailProvider.send).toHaveBeenCalledTimes(1);
		expect(fakeEmailProvider.send).toHaveBeenCalledWith(email, expect.stringMatching(/^\d{6}$/));

		const otpRows = await dataSource.query(
			'SELECT "code_hash" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(1);
	});

	it("resets the password, revokes existing refresh tokens, invalidates OTP, and writes audit", async () => {
		const { userId, email } = await registerAndActivateUser("reset-success");

		const loginResponse = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);
		expect(loginResponse.body.refreshToken).toEqual(expect.any(String));

		const code = await authService.issueOtp(userId);

		await request(app.getHttpServer())
			.post("/api/auth/reset-password")
			.send({ identifier: email, code, newPassword: NEW_PASSWORD })
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual({ passwordReset: true });
			});

		const userRows = await dataSource.query('SELECT "password_hash" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(await bcrypt.compare(NEW_PASSWORD, userRows[0].password_hash)).toBe(true);

		const refreshRows = await dataSource.query(
			'SELECT "revoked_at" FROM "refresh_tokens" WHERE "user_id" = $1',
			[userId]
		);
		expect(refreshRows).toHaveLength(1);
		expect(refreshRows[0].revoked_at).toBeTruthy();

		const otpRows = await dataSource.query(
			'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(0);

		const auditRows = await dataSource.query(
			'SELECT "action", "reason" FROM "audit_logs" WHERE "target_id" = $1',
			[userId]
		);
		const resetLogs = auditRows.filter(
			(r: { action: string }) => r.action === "auth.password_reset"
		);
		expect(resetLogs).toHaveLength(1);
		expect(resetLogs[0]).toEqual(
			expect.objectContaining({
				action: "auth.password_reset",
				reason: "forgot_password_otp_verified",
			})
		);
	});

	it("rejects an expired reset OTP and leaves password/session state unchanged", async () => {
		const { userId, email } = await registerAndActivateUser("reset-expired");
		await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);
		const code = await authService.issueOtp(userId);
		const beforeRows = await dataSource.query(
			'SELECT "password_hash" FROM "users" WHERE "id" = $1',
			[userId]
		);
		await dataSource.query(
			'UPDATE "verification_otps" SET "expires_at" = $1 WHERE "user_id" = $2',
			[new Date(Date.now() - 1000), userId]
		);

		await request(app.getHttpServer())
			.post("/api/auth/reset-password")
			.send({ identifier: email, code, newPassword: NEW_PASSWORD })
			.expect(409);

		const afterRows = await dataSource.query(
			'SELECT "password_hash" FROM "users" WHERE "id" = $1',
			[userId]
		);
		expect(afterRows[0].password_hash).toBe(beforeRows[0].password_hash);

		const activeRefreshRows = await dataSource.query(
			'SELECT * FROM "refresh_tokens" WHERE "user_id" = $1 AND "revoked_at" IS NULL',
			[userId]
		);
		expect(activeRefreshRows).toHaveLength(1);
	});
});
