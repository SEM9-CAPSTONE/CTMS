import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("POST /api/auth/register (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let cleanupEmails: string[];
	let cleanupPhones: string[];
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
	});

	afterEach(async () => {
		if (cleanupEmails?.length) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" IN (SELECT id FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query('DELETE FROM "users" WHERE "email" = ANY($1)', [cleanupEmails]);
		}
		if (cleanupPhones?.length) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" IN (SELECT id FROM "users" WHERE "phone" = ANY($1))',
				[cleanupPhones]
			);
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

	// --- Success path (email and phone are both mandatory now) ---------------

	it("registers successfully with email and phone", async () => {
		const email = uniqueEmail("register-success");
		const local = uniqueLocalPhone();
		const phone = `+84${local.slice(1)}`;
		cleanupEmails.push(email);
		cleanupPhones.push(phone);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "correct-horse", role: "camper" })
			.expect(201);

		expect(response.body).toMatchObject({
			email,
			phone,
			role: "camper",
			status: "pending_verification",
		});
		expect(response.body.id).toEqual(expect.any(String));

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "email" = $1', [email]);
		expect(rows).toHaveLength(1);
		expect(rows[0].phone).toBe(phone);
		expect(rows[0].role).toBe("camper");

		const auditRows = await dataSource.query('SELECT * FROM "audit_logs" WHERE "actor_id" = $1', [
			response.body.id,
		]);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].action).toBe("auth.register");
		expect(auditRows[0].target_type).toBe("user");
		expect(auditRows[0].target_id).toBe(response.body.id);
		expect(auditRows[0].before).toBeNull();
		expect(auditRows[0].after).toEqual({ role: "camper" });
	});

	// --- Normalization ------------------------------------------------------
	// Both fields are mandatory, so the second field (a valid, unique value)
	// is included purely to satisfy the presence check — each test still only
	// asserts normalization of the one field it targets.

	it("normalizes email (trim + lowercase) before storing", async () => {
		const canonical = uniqueEmail("normalize-email");
		const raw = `  ${canonical.toUpperCase()}  `;
		const local = uniqueLocalPhone();
		cleanupEmails.push(canonical);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email: raw, phone: local, password: "x", role: "camper" })
			.expect(201);

		expect(response.body.email).toBe(canonical);

		const rows = await dataSource.query('SELECT "email" FROM "users" WHERE "email" = $1', [
			canonical,
		]);
		expect(rows).toHaveLength(1);
	});

	it("normalizes phone to E.164 before storing", async () => {
		const local = uniqueLocalPhone();
		const expectedE164 = `+84${local.slice(1)}`;
		const email = uniqueEmail("normalize-phone");
		cleanupEmails.push(email);
		cleanupPhones.push(expectedE164);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		expect(response.body.phone).toBe(expectedE164);

		const rows = await dataSource.query('SELECT "phone" FROM "users" WHERE "phone" = $1', [
			expectedE164,
		]);
		expect(rows).toHaveLength(1);
	});

	// --- Duplicate detection -------------------------------------------------
	// The second request uses a fresh, non-colliding value for the *other*
	// field so the 409 is attributable only to the field under test.

	it("rejects a duplicate email with 409 and does not create a second row", async () => {
		const email = uniqueEmail("dup-email");
		const firstLocal = uniqueLocalPhone();
		const secondLocal = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${firstLocal.slice(1)}`, `+84${secondLocal.slice(1)}`);

		await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: firstLocal, password: "x", role: "camper" })
			.expect(201);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email: email.toUpperCase(), phone: secondLocal, password: "y", role: "host" })
			.expect(409);

		expect(response.body.statusCode).toBe(409);

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "email" = $1', [email]);
		expect(rows).toHaveLength(1);
	});

	it("rejects a duplicate phone with 409 and does not create a second row", async () => {
		const local = uniqueLocalPhone();
		const e164 = `+84${local.slice(1)}`;
		const firstEmail = uniqueEmail("dup-phone-first");
		const secondEmail = uniqueEmail("dup-phone-second");
		cleanupEmails.push(firstEmail, secondEmail);
		cleanupPhones.push(e164);

		await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email: firstEmail, phone: local, password: "x", role: "camper" })
			.expect(201);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email: secondEmail, phone: e164, password: "y", role: "host" })
			.expect(409);

		expect(response.body.statusCode).toBe(409);

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "phone" = $1', [e164]);
		expect(rows).toHaveLength(1);
	});

	// --- Validation (422) — email and phone are both mandatory ---------------

	it("rejects when email is missing (422) and creates no row", async () => {
		const local = uniqueLocalPhone();
		const phone = `+84${local.slice(1)}`;
		cleanupPhones.push(phone);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ phone: local, password: "x", role: "camper" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "phone" = $1', [phone]);
		expect(rows).toHaveLength(0);
	});

	it("rejects when phone is missing (422) and creates no row", async () => {
		const email = uniqueEmail("missing-phone");
		cleanupEmails.push(email);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, password: "x", role: "camper" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "email" = $1', [email]);
		expect(rows).toHaveLength(0);
	});

	it("rejects when both email and phone are missing (422) and creates no row", async () => {
		const before = await dataSource.query('SELECT COUNT(*)::int AS count FROM "users"');

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ password: "x", role: "camper" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);

		const after = await dataSource.query('SELECT COUNT(*)::int AS count FROM "users"');
		expect(after[0].count).toBe(before[0].count);
	});

	it("rejects an invalid role (422) and creates no row", async () => {
		const email = uniqueEmail("invalid-role");
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "admin" })
			.expect(422);

		expect(response.body.statusCode).toBe(422);

		const rows = await dataSource.query('SELECT * FROM "users" WHERE "email" = $1', [email]);
		expect(rows).toHaveLength(0);
	});

	// --- Response and persistence safety -------------------------------------

	it("never includes passwordHash in the HTTP response", async () => {
		const email = uniqueEmail("no-hash-leak");
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		expect(Object.hasOwn(response.body, "passwordHash")).toBe(false);
		expect(Object.keys(response.body).sort()).toEqual(
			["createdAt", "email", "id", "phone", "role", "status"].sort()
		);
	});

	it("stores the password as a real bcrypt hash (cost 10), not plaintext", async () => {
		const email = uniqueEmail("bcrypt-check");
		const local = uniqueLocalPhone();
		const plainPassword = "SuperSecret123!";
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: plainPassword, role: "camper" })
			.expect(201);

		const rows = await dataSource.query('SELECT "password_hash" FROM "users" WHERE "email" = $1', [
			email,
		]);
		const storedHash: string = rows[0].password_hash;

		expect(storedHash).not.toBe(plainPassword);
		expect(storedHash.startsWith("$2b$10$")).toBe(true);
		await expect(bcrypt.compare(plainPassword, storedHash)).resolves.toBe(true);
	});

	it("defaults the account status to pending_verification", async () => {
		const email = uniqueEmail("status-default");
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: "x", role: "camper" })
			.expect(201);

		expect(response.body.status).toBe("pending_verification");

		const rows = await dataSource.query('SELECT "status" FROM "users" WHERE "email" = $1', [email]);
		expect(rows[0].status).toBe("pending_verification");
	});
});
