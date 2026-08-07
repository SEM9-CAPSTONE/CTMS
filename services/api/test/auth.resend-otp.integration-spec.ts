import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("POST /api/auth/resend (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
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

	async function registerUser(tag: string): Promise<string> {
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
		return userId;
	}

	// --- Success path (AC2, BR-007) -------------------------------------------

	it("creates a verification_otps row and returns 200 (placeholder response, Decision Gate open)", async () => {
		const userId = await registerUser("resend-success");

		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId })
			.expect(200);

		// Response shape is an open Decision Gate (Step 6) -- only asserting
		// what has actually been decided so far: no OTP code anywhere in the body.
		expect(JSON.stringify(response.body)).not.toMatch(/"code"/);

		const otpRows = await dataSource.query(
			'SELECT "send_count" FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(1);
		expect(otpRows[0].send_count).toBe(1);
	});

	// --- Validation (422, BR-205) ---------------------------------------------

	it("rejects an invalid userId (not a uuid) with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId: "not-a-uuid" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	// --- Resend limit (409, AC2, BR-007) ---------------------------------------
	// Default OTP_RESEND_MAX_ATTEMPTS=5 (.env.example) allows 1 initial send +
	// 4 resends = 5 total successful calls before the 6th is rejected. If the
	// real running environment does not actually load this env var, the
	// known NaN-comparison gap (Step 4/6 review, "Invalid Date"/limit-check
	// bug) may cause this test to observe different behavior than expected --
	// that would be a real, reportable result, not a flaw in this test.

	it("returns 409 once the configured resend limit is exceeded within the window", async () => {
		const userId = await registerUser("resend-limit");

		for (let i = 0; i < 5; i++) {
			await request(app.getHttpServer()).post("/api/auth/resend").send({ userId }).expect(200);
		}

		const response = await request(app.getHttpServer())
			.post("/api/auth/resend")
			.send({ userId })
			.expect(409);

		expect(response.body.statusCode).toBe(409);
	});
});
