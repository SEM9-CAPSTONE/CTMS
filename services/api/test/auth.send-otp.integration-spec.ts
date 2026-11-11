import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import {
	EMAIL_OTP_PROVIDER,
	type OtpNotificationProvider,
	SMS_OTP_PROVIDER,
} from "../src/modules/auth/providers/otp-notification-provider.interface";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

/**
 * Fake providers replace the real Twilio/Resend clients for this whole
 * suite (see the .overrideProvider() calls below) -- integration tests
 * exercise the real HTTP -> AuthService -> Postgres path without spending
 * real money or depending on a real network call to an external vendor.
 * SmsOtpProvider/EmailOtpProvider themselves already have their own unit
 * tests (sms-otp.provider.spec.ts, email-otp.provider.spec.ts) proving the
 * real SDK wiring; that is not re-proven here.
 */
function buildFakeProvider(): jest.Mocked<OtpNotificationProvider> {
	return { send: jest.fn().mockResolvedValue(undefined) };
}

describe("POST /api/auth/send-otp (integration, real Postgres, fake delivery providers)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let cleanupEmails: string[];
	let cleanupPhones: string[];
	let cleanupUserIds: string[];
	let phoneSeq = 0;
	let fakeSmsProvider: jest.Mocked<OtpNotificationProvider>;
	let fakeEmailProvider: jest.Mocked<OtpNotificationProvider>;

	beforeAll(async () => {
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
		fakeSmsProvider.send.mockClear().mockResolvedValue(undefined);
		fakeEmailProvider.send.mockClear().mockResolvedValue(undefined);
	});

	afterEach(async () => {
		if (cleanupUserIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[cleanupUserIds]
			);
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

	async function registerUser(
		tag: string
	): Promise<{ userId: string; email: string; phone: string }> {
		const email = uniqueEmail(tag);
		const local = uniqueLocalPhone();
		const phone = `+84${local.slice(1)}`;
		cleanupEmails.push(email);
		cleanupPhones.push(phone);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		const userId: string = response.body.id;
		cleanupUserIds.push(userId);
		return { userId, email, phone };
	}

	// --- Success, phone channel ------------------------------------------

	it("creates a verification_otps row and dispatches via the phone provider when channel=phone", async () => {
		const { userId, phone } = await registerUser("send-otp-phone");

		const response = await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "phone" })
			.expect(200);

		expect(JSON.stringify(response.body)).not.toMatch(/"code"/);
		expect(fakeSmsProvider.send).toHaveBeenCalledTimes(1);
		expect(fakeSmsProvider.send).toHaveBeenCalledWith(phone, expect.stringMatching(/^\d{6}$/));
		expect(fakeEmailProvider.send).not.toHaveBeenCalled();

		const otpRows = await dataSource.query(
			'SELECT "send_count" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(1);
		expect(otpRows[0].send_count).toBe(1);
	});

	// --- Success, email channel -------------------------------------------

	it("creates a verification_otps row and dispatches via the email provider when channel=email", async () => {
		const { userId, email } = await registerUser("send-otp-email");

		await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "email" })
			.expect(200);

		expect(fakeEmailProvider.send).toHaveBeenCalledTimes(1);
		expect(fakeEmailProvider.send).toHaveBeenCalledWith(email, expect.stringMatching(/^\d{6}$/));
		expect(fakeSmsProvider.send).not.toHaveBeenCalled();
	});

	// --- Validation (422, BR-205) -------------------------------------------

	it("rejects a missing channel with 422", async () => {
		const { userId } = await registerUser("send-otp-missing-channel");

		const response = await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	it("rejects an invalid channel value with 422", async () => {
		const { userId } = await registerUser("send-otp-bad-channel");

		const response = await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "zalo" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	it("rejects an invalid userId (not a uuid) with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId: "not-a-uuid", channel: "phone" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	// --- Dispatch failure: Generate -> Deliver -> Persist ordering
	// (Tech Lead requirement) — a failed delivery must NOT create/update the
	// verification_otps row, so the attempt is not counted against BR-007. ---

	it("does not create a verification_otps row when the provider fails to deliver", async () => {
		const { userId } = await registerUser("send-otp-dispatch-fail");
		fakeSmsProvider.send.mockRejectedValueOnce(new Error("Twilio: simulated outage"));

		await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "phone" })
			.expect(500);

		const otpRows = await dataSource.query(
			'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(0);

		// The user can immediately retry and it succeeds -- no attempt was burned.
		const retryResponse = await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "phone" })
			.expect(200);
		expect(retryResponse.status).toBe(200);

		const retriedRows = await dataSource.query(
			'SELECT "send_count" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(retriedRows[0].send_count).toBe(1); // still 1, not 2 -- the failed attempt was never counted
	});
});
