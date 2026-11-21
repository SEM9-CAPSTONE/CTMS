import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import {
	GoogleIdTokenVerifier,
	type GoogleIdentity,
} from "../src/modules/auth/providers/google-id-token.verifier";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

/**
 * Google is never called: the verifier is replaced by a fake that maps an opaque
 * test token to an identity, so these tests cover CTMS's own rules on real Postgres.
 */
class FakeGoogleVerifier {
	enabled = true;
	identities = new Map<string, GoogleIdentity>();

	isEnabled(): boolean {
		return this.enabled;
	}

	async verify(idToken: string): Promise<GoogleIdentity | null> {
		return this.identities.get(idToken) ?? null;
	}
}

describe("POST /api/auth/google (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let authService: AuthService;
	const google = new FakeGoogleVerifier();
	let cleanupEmails: string[];
	let cleanupUserIds: string[];
	let seq = 0;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GoogleIdTokenVerifier)
			.useValue(google)
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
	});

	afterAll(async () => {
		const leftover = await dataSource.query(
			"SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'e2e-google-%'"
		);
		expect(leftover[0].count).toBe(0);
		await app.close();
	});

	beforeEach(() => {
		cleanupEmails = [];
		cleanupUserIds = [];
		google.enabled = true;
		google.identities.clear();
	});

	afterEach(async () => {
		const ids: string[] = cleanupEmails.length
			? (
					await dataSource.query('SELECT "id" FROM "users" WHERE "email" = ANY($1)', [
						cleanupEmails,
					])
				).map((row: { id: string }) => row.id)
			: [];
		const all = [...new Set([...ids, ...cleanupUserIds])];
		if (all.length) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [all]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [all]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [all]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [all]);
		}
	});

	function identity(overrides: Partial<GoogleIdentity> = {}): {
		token: string;
		who: GoogleIdentity;
	} {
		seq += 1;
		const who: GoogleIdentity = {
			subject: `google-sub-${Date.now()}-${seq}`,
			email: `e2e-google-${Date.now()}-${seq}@example.com`,
			emailVerified: true,
			name: "Nguyễn Thị Hoa",
			picture: "https://lh3.googleusercontent.com/a/photo",
			...overrides,
		};
		const token = `test-token-${seq}`;
		google.identities.set(token, who);
		cleanupEmails.push(who.email.toLowerCase());
		return { token, who };
	}

	async function register(email: string, activate: boolean): Promise<string> {
		seq += 1;
		const phone = `09${String(20000000 + seq).padStart(8, "0")}`;
		const response = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone, password: "S3curePass!", role: "camper" })
			.expect(201);
		const userId: string = response.body.id;
		cleanupUserIds.push(userId);
		if (activate) {
			const code = await authService.issueOtp(userId);
			await request(app.getHttpServer())
				.post("/api/auth/verify")
				.send({ userId, code })
				.expect(200);
		}
		return userId;
	}

	const signIn = (idToken: string) =>
		request(app.getHttpServer()).post("/api/auth/google").send({ idToken });

	it("creates an active Camper account for a new Google e-mail", async () => {
		const { token, who } = identity();

		const response = await signIn(token).expect(200);

		expect(response.body.accessToken).toEqual(expect.any(String));
		expect(response.body.refreshToken).toEqual(expect.any(String));
		expect(response.body.user).toMatchObject({
			email: who.email,
			status: "active",
			role: "camper",
		});
		const [row] = await dataSource.query(
			'SELECT "google_sub", "full_name", "avatar_url", "phone" FROM "users" WHERE "id" = $1',
			[response.body.user.id]
		);
		expect(row).toEqual({
			google_sub: who.subject,
			full_name: "Nguyễn Thị Hoa",
			avatar_url: who.picture,
			phone: null,
		});
		const audit = await dataSource.query(
			'SELECT "action", "after" FROM "audit_logs" WHERE "actor_id" = $1 ORDER BY "created_at"',
			[response.body.user.id]
		);
		expect(audit).toEqual([
			{ action: "auth.register", after: { method: "google", role: "camper" } },
			{ action: "auth.login", after: { method: "google" } },
		]);
	});

	it("signs in the existing account with the same e-mail and links the Google account", async () => {
		const { token, who } = identity();
		const userId = await register(who.email, true);

		const response = await signIn(token).expect(200);

		expect(response.body.user.id).toBe(userId);
		const [row] = await dataSource.query('SELECT "google_sub" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(row.google_sub).toBe(who.subject);
	});

	it("keeps finding the linked account after the Google e-mail changes", async () => {
		const first = identity();
		const created = await signIn(first.token).expect(200);
		const renamed = identity({ subject: first.who.subject });

		const response = await signIn(renamed.token).expect(200);

		expect(response.body.user.id).toBe(created.body.user.id);
	});

	it("activates an account still waiting for OTP verification", async () => {
		const { token, who } = identity();
		const userId = await register(who.email, false);

		const response = await signIn(token).expect(200);

		expect(response.body.user).toMatchObject({ id: userId, status: "active" });
	});

	it("refuses a suspended account", async () => {
		const { token, who } = identity();
		const userId = await register(who.email, true);
		await dataSource.query(`UPDATE "users" SET "status" = 'suspended' WHERE "id" = $1`, [userId]);

		await signIn(token).expect(401);
		const tokens = await dataSource.query('SELECT 1 FROM "refresh_tokens" WHERE "user_id" = $1', [
			userId,
		]);
		expect(tokens).toHaveLength(0);
	});

	it("refuses an e-mail already linked to another Google account", async () => {
		const first = identity();
		await signIn(first.token).expect(200);
		const other = identity({ email: first.who.email });

		await signIn(other.token).expect(401);
	});

	it("refuses an invalid token and an unverified Google e-mail", async () => {
		await signIn("not-a-google-token").expect(401);
		const { token } = identity({ emailVerified: false });
		await signIn(token).expect(401);
	});

	it("answers 503 when Google sign-in is not configured", async () => {
		google.enabled = false;
		await signIn("anything").expect(503);
	});

	it("rejects a missing token with 422", async () => {
		await request(app.getHttpServer()).post("/api/auth/google").send({}).expect(422);
	});
});
