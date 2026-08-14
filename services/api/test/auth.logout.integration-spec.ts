import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("POST /api/auth/logout (integration, real Postgres)", () => {
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
		await app.close();
	});

	beforeEach(() => {
		cleanupEmails = [];
		cleanupPhones = [];
		cleanupUserIds = [];
	});

	afterEach(async () => {
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

	async function registerAndLogin(tag: string): Promise<{
		userId: string;
		email: string;
		accessToken: string;
		refreshToken: string;
	}> {
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

		return {
			userId,
			email,
			accessToken: loginResponse.body.accessToken,
			refreshToken: loginResponse.body.refreshToken,
		};
	}

	async function loginAgain(email: string): Promise<{ accessToken: string; refreshToken: string }> {
		const loginResponse = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);

		return {
			accessToken: loginResponse.body.accessToken,
			refreshToken: loginResponse.body.refreshToken,
		};
	}

	it("revokes only the current device refresh token", async () => {
		const firstSession = await registerAndLogin("logout-current");
		const secondSession = await loginAgain(firstSession.email);

		await request(app.getHttpServer())
			.post("/api/auth/logout")
			.set("Authorization", `Bearer ${firstSession.accessToken}`)
			.send({ refreshToken: firstSession.refreshToken })
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual({ loggedOut: true });
			});

		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: firstSession.refreshToken })
			.expect(401);

		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: secondSession.refreshToken })
			.expect(200);
	});

	it("revokes every active refresh token for logout all devices", async () => {
		const firstSession = await registerAndLogin("logout-all");
		const secondSession = await loginAgain(firstSession.email);

		await request(app.getHttpServer())
			.post("/api/auth/logout")
			.set("Authorization", `Bearer ${firstSession.accessToken}`)
			.send({ refreshToken: firstSession.refreshToken, allDevices: true })
			.expect(200);

		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: firstSession.refreshToken })
			.expect(401);
		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: secondSession.refreshToken })
			.expect(401);
	});

	it("does not revoke a refresh token owned by another user", async () => {
		const firstUser = await registerAndLogin("logout-owner-a");
		const secondUser = await registerAndLogin("logout-owner-b");

		await request(app.getHttpServer())
			.post("/api/auth/logout")
			.set("Authorization", `Bearer ${firstUser.accessToken}`)
			.send({ refreshToken: secondUser.refreshToken })
			.expect(401);

		await request(app.getHttpServer())
			.post("/api/auth/refresh")
			.send({ refreshToken: secondUser.refreshToken })
			.expect(200);
	});

	it("keeps repeated logout safe and does not duplicate audit logs", async () => {
		const session = await registerAndLogin("logout-repeat");

		for (let i = 0; i < 2; i += 1) {
			await request(app.getHttpServer())
				.post("/api/auth/logout")
				.set("Authorization", `Bearer ${session.accessToken}`)
				.send({ refreshToken: session.refreshToken })
				.expect(200);
		}

		const rows = await dataSource.query('SELECT "action" FROM "audit_logs" WHERE "actor_id" = $1', [
			session.userId,
		]);
		const logoutLogs = rows.filter((row: { action: string }) => row.action === "auth.logout");
		expect(logoutLogs).toHaveLength(1);
	});

	it("requires an access token", async () => {
		const session = await registerAndLogin("logout-auth-required");

		await request(app.getHttpServer())
			.post("/api/auth/logout")
			.send({ refreshToken: session.refreshToken })
			.expect(401);
	});

	it("rejects a missing refreshToken with 422", async () => {
		const session = await registerAndLogin("logout-validation");

		const response = await request(app.getHttpServer())
			.post("/api/auth/logout")
			.set("Authorization", `Bearer ${session.accessToken}`)
			.send({})
			.expect(422);

		expect(response.body.statusCode).toBe(422);
	});
});
