import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
// biome-ignore lint/style/useImportType: resolved from the DI container at runtime (moduleRef.get), needs design:paramtypes metadata
import { AuthService } from "../src/modules/auth/auth.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("POST /api/auth/verify (integration, real Postgres)", () => {
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
		// Sanity net: confirm every per-test cleanup actually worked and no
		// e2e-tagged row was left behind across the whole suite.
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

	/**
	 * Arrange-phase helper only (Decision Gate #2, Step 8 Phase 2): registers a
	 * real user over HTTP, then calls AuthService.issueOtp() directly to obtain
	 * the raw code -- the only way to obtain it, since no API response or log
	 * ever exposes it (Step 6 decision). Act/Assert for the behavior under
	 * test still goes through the HTTP endpoint via supertest below.
	 */
	async function registerAndIssueOtp(tag: string): Promise<{ userId: string; code: string }> {
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

		const code = await authService.issueOtp(userId);

		return { userId, code };
	}

	// --- Success path (AC3, BR-006) ------------------------------------------

	it("activates the account and returns 200 when the code is correct and not expired", async () => {
		const { userId, code } = await registerAndIssueOtp("verify-success");

		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId, code })
			.expect(200);

		expect(response.body.status).toBe("active");

		const userRows = await dataSource.query('SELECT "status" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(userRows[0].status).toBe("active");

		// Replay prevention (Step 5 review): OTP row must be deleted on success.
		const otpRows = await dataSource.query(
			'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(0);
	});

	// --- Validation (422, BR-205) ---------------------------------------------

	it("rejects an invalid userId (not a uuid) with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId: "not-a-uuid", code: "123456" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	it("rejects a missing code with 422", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId: randomUUID() })
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});

	// --- Not found (404, AC3) --------------------------------------------------

	it("returns 404 when there is no pending OTP for the account", async () => {
		const email = uniqueEmail("verify-not-found");
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		// No issueOtp() call here -- no verification_otps row exists for this user.
		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId, code: "123456" })
			.expect(404);

		expect(response.body.statusCode).toBe(404);
	});

	// --- Incorrect code (409, AC3, BR-243 no side effect) -----------------------

	it("returns 409 and does not activate the account when the code is incorrect", async () => {
		const { userId } = await registerAndIssueOtp("verify-incorrect");

		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId, code: "000000" })
			.expect(409);

		expect(response.body.statusCode).toBe(409);

		const userRows = await dataSource.query('SELECT "status" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(userRows[0].status).toBe("pending_verification");

		const otpRows = await dataSource.query(
			'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
			[userId]
		);
		expect(otpRows).toHaveLength(1);
	});

	// --- Expired code (409, AC3, BR-006/BR-220) ----------------------------------

	it("returns 409 when the OTP has expired, even with the correct code", async () => {
		const { userId, code } = await registerAndIssueOtp("verify-expired");

		await dataSource.query(
			'UPDATE "verification_otps" SET "expires_at" = $1 WHERE "user_id" = $2',
			[new Date(Date.now() - 60_000), userId]
		);

		const response = await request(app.getHttpServer())
			.post("/api/auth/verify")
			.send({ userId, code })
			.expect(409);

		expect(response.body.statusCode).toBe(409);

		const userRows = await dataSource.query('SELECT "status" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(userRows[0].status).toBe("pending_verification");
	});
});
