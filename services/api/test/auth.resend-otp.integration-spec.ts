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

/** See auth.send-otp.integration-spec.ts's comment on why fake providers replace the real SDKs here. */
function buildFakeProvider(): jest.Mocked<OtpNotificationProvider> {
	return { send: jest.fn().mockResolvedValue(undefined) };
}

describe("POST /api/auth/resend (integration, real Postgres, fake delivery providers)", () => {
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
		// FK: verification_otps.user_id -> users.id, no ON DELETE CASCADE
		// (removed at Step 1 review) -- must delete verification_otps rows
		// before deleting their owning users row.
		if (cleanupUserIds.length > 0) {
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

	/** Registers a user and sends the first OTP via /send-otp, so there is an
	 * existing verification_otps row for /resend to act on. */
	async function registerAndSendFirstOtp(tag: string): Promise<string> {
		const email = uniqueEmail(tag);
		const local = uniqueLocalPhone();
		const phone = `+84${local.slice(1)}`;
		cleanupEmails.push(email);
		cleanupPhones.push(phone);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		await request(app.getHttpServer())
			.post("/api/auth/send-otp")
			.send({ userId, channel: "phone" })
			.expect(200);

		return userId;
	}

	// --- Success path (AC2, BR-007) -------------------------------------------

	it("regenerates the code, increments send_count, and dispatches again", async () => {
		const userId = await registerAndSendFirstOtp("resend-success");
		fakeSmsProvider.send.mockClear();

		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId, channel: "phone" })
			.expect(200);

		expect(JSON.stringify(response.body)).not.toMatch(/"code"/);
		expect(fakeSmsProvider.send).toHaveBeenCalledTimes(1);

		const otpRows = await dataSource.query(
			'SELECT "send_count" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(1);
		expect(otpRows[0].send_count).toBe(2); // 1 from send-otp + 1 from this resend
	});

	// --- Switching channel mid-flow ------------------------------------------

	it("allows switching channel on resend (e.g. phone didn't arrive, try email)", async () => {
		const userId = await registerAndSendFirstOtp("resend-switch-channel");
		fakeSmsProvider.send.mockClear();

		await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId, channel: "email" })
			.expect(200);

		expect(fakeEmailProvider.send).toHaveBeenCalledTimes(1);
		expect(fakeSmsProvider.send).not.toHaveBeenCalled();
	});

	// --- Validation (422, BR-205) ---------------------------------------------

	it("rejects an invalid userId (not a uuid) with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId: "not-a-uuid", channel: "phone" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	it("rejects a missing channel with 422", async () => {
		const userId = await registerAndSendFirstOtp("resend-missing-channel");

		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	// --- Resend limit (409, AC2, BR-007) ---------------------------------------
	// Default OTP_RESEND_MAX_ATTEMPTS=5 (.env.example): 1 initial send (via
	// /send-otp) + 4 more successful /resend calls = 5 total before the 6th
	// call within the window is rejected.

	it("returns 409 once the configured resend limit is exceeded within the window", async () => {
		const userId = await registerAndSendFirstOtp("resend-limit");
		fakeSmsProvider.send.mockClear(); // registerAndSendFirstOtp already made 1 call

		for (let i = 0; i < 4; i++) {
			await request(app.getHttpServer())
				.post("/api/auth/resend")
				.send({ userId, channel: "phone" })
				.expect(200);
		}

		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId, channel: "phone" })
			.expect(409);

		expect(response.body.statusCode).toBe(409);
		// The 6th (rejected) call must never have reached the provider.
		expect(fakeSmsProvider.send).toHaveBeenCalledTimes(4);
	});

	// --- Dispatch failure does not consume a resend attempt --------------------

	it("does not increment send_count when the provider fails on resend", async () => {
		const userId = await registerAndSendFirstOtp("resend-dispatch-fail");
		fakeSmsProvider.send.mockRejectedValueOnce(new Error("Twilio: simulated outage"));

		await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId, channel: "phone" })
			.expect(500);

		const otpRows = await dataSource.query(
			'SELECT "send_count" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows[0].send_count).toBe(1); // unchanged -- still just the initial send-otp
	});
});
