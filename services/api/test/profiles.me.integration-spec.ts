import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("PATCH /api/profiles/me (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let authService: AuthService;
	let jwtService: JwtService;
	let cleanupUserIds: string[];
	let cleanupEmails: string[];
	let cleanupPhones: string[];
	let phoneSeq = 0;

	const PASSWORD = "S3curePass!";

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
		jwtService = moduleRef.get(JwtService);
		expect(dataSource.isInitialized).toBe(true);
	});

	afterAll(async () => {
		const leftover = await dataSource.query(
			"SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'e2e-profile-%'"
		);
		expect(leftover[0].count).toBe(0);

		await app.close();
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupEmails = [];
		cleanupPhones = [];
	});

	afterEach(async () => {
		if (cleanupUserIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "emergency_contacts" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
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
		return `e2e-profile-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
	}

	function uniqueLocalPhone(): string {
		phoneSeq += 1;
		return `09${String(20000000 + phoneSeq).padStart(8, "0")}`;
	}

	async function registerAndActivateUser(tag: string): Promise<{
		userId: string;
		email: string;
		accessToken: string;
	}> {
		const email = uniqueEmail(tag);
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: PASSWORD, role: UserRole.CAMPER })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		const code = await authService.issueOtp(userId);
		await request(app.getHttpServer()).post("/api/auth/verify").send({ userId, code }).expect(200);

		const loginResponse = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);

		return { userId, email, accessToken: loginResponse.body.accessToken };
	}

	it("updates valid profile fields and creates an emergency contact", async () => {
		const { userId, accessToken } = await registerAndActivateUser("success-create");

		const response = await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				fullName: "Nguyen Van B",
				dateOfBirth: "1995-04-12",
				gender: "male",
				address: "Da Lat, Lam Dong",
				bio: "Weekend trekker",
				emergencyContacts: [
					{
						name: "Tran Thi C",
						relationship: "mother",
						phone: "0911111111",
						email: "mom@example.com",
					},
				],
			})
			.expect(200);

		expect(response.body).toMatchObject({
			id: userId,
			fullName: "Nguyen Van B",
			dateOfBirth: "1995-04-12",
			gender: "male",
			address: "Da Lat, Lam Dong",
			bio: "Weekend trekker",
			emergencyContacts: [
				{
					name: "Tran Thi C",
					relationship: "mother",
					phone: "+84911111111",
					email: "mom@example.com",
				},
			],
		});
		expect(response.body.passwordHash).toBeUndefined();

		const contacts = await dataSource.query(
			'SELECT * FROM "emergency_contacts" WHERE "user_id" = $1',
			[userId]
		);
		expect(contacts).toHaveLength(1);

		const audits = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[userId, "profile.updated"]
		);
		expect(audits).toHaveLength(1);
	});

	it("updates an existing emergency contact without creating duplicates on retry", async () => {
		const { userId, accessToken } = await registerAndActivateUser("contact-update");

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				emergencyContacts: [{ name: "Tran Thi C", relationship: "mother", phone: "0911111111" }],
			})
			.expect(200);

		const payload = {
			emergencyContacts: [
				{
					name: "Le Van D",
					relationship: "brother",
					phone: "0922222222",
					email: "brother@example.com",
				},
			],
		};

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send(payload)
			.expect(200);
		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send(payload)
			.expect(200);

		const contacts = await dataSource.query(
			'SELECT "name", "relationship", "phone", "email" FROM "emergency_contacts" WHERE "user_id" = $1',
			[userId]
		);
		expect(contacts).toEqual([
			{
				name: "Le Van D",
				relationship: "brother",
				phone: "+84922222222",
				email: "brother@example.com",
			},
		]);
	});

	it("rejects invalid profile data and preserves the previous database state", async () => {
		const { userId, accessToken } = await registerAndActivateUser("invalid");

		const response = await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				fullName: "A",
				emergencyContacts: [
					{ name: "One", relationship: "friend", phone: "0911111111" },
					{ name: "Two", relationship: "friend", phone: "0922222222" },
					{ name: "Three", relationship: "friend", phone: "0933333333" },
				],
			})
			.expect(422);

		expect(response.body.statusCode).toBe(422);

		const contacts = await dataSource.query(
			'SELECT * FROM "emergency_contacts" WHERE "user_id" = $1',
			[userId]
		);
		expect(contacts).toHaveLength(0);
	});

	it("rejects unauthenticated requests", async () => {
		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.send({ fullName: "Nguyen Van B" })
			.expect(401);
	});

	it("rejects non-active authenticated sessions with 401 and no side effects", async () => {
		const { userId, accessToken } = await registerAndActivateUser("suspended");
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
			"suspended",
			userId,
		]);

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ fullName: "Should Not Persist" })
			.expect(401);

		const rows = await dataSource.query('SELECT "full_name" FROM "users" WHERE "id" = $1', [
			userId,
		]);
		expect(rows[0].full_name).toBeNull();
	});

	it("protects sensitive fields from mass assignment", async () => {
		const { userId, accessToken } = await registerAndActivateUser("mass-assignment");

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				fullName: "Nguyen Van B",
				role: "admin",
				status: "deleted",
				passwordHash: "plaintext",
			})
			.expect(422);

		const rows = await dataSource.query(
			'SELECT "role", "status", "password_hash" FROM "users" WHERE "id" = $1',
			[userId]
		);
		expect(rows[0].role).toBe(UserRole.CAMPER);
		expect(rows[0].status).toBe("active");
		expect(rows[0].password_hash).not.toBe("plaintext");
	});

	it("rejects a token for a missing user with 404", async () => {
		const accessToken = jwtService.sign({
			sub: "33333333-3333-3333-3333-333333333333",
			roles: [UserRole.CAMPER],
		});

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ fullName: "Nguyen Van B" })
			.expect(404);
	});
});
