import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-385 authoritative push preferences", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	const a = randomUUID();
	const b = randomUUID();
	const auth = (user = a) => `Bearer ${jwt.sign({ sub: user, roles: ["camper"] })}`;
	const get = (user = a) =>
		request(app.getHttpServer())
			.get("/api/notification-preferences")
			.set("Authorization", auth(user));
	const patch = (body: object, user = a) =>
		request(app.getHttpServer())
			.patch("/api/notification-preferences")
			.set("Authorization", auth(user))
			.send(body);
	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		await assertSafeTestDatabase(db);
		for (const user of [a, b]) {
			await db.query(
				`INSERT INTO users(id,email,password_hash,role,status,full_name)
				VALUES($1,$2,'unused','camper','active','Nguyễn Văn An')`,
				[user, `${user}@example.test`]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'camper')", [user]);
		}
	}, 60000);
	afterAll(async () => {
		if (db?.isInitialized) {
			await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [[a, b]]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [[a, b]]);
		}
		await app?.close();
	});

	it("returns version zero defaults without creating preference records", async () => {
		const result = await get().expect(200);
		expect(result.body.version).toBe(0);
		expect(result.body.categories.every((item: { enabled: boolean }) => item.enabled)).toBe(true);
		await request(app.getHttpServer()).get("/api/notification-preferences").expect(401);
	});

	it("allows only one concurrent first save and preserves unspecified categories", async () => {
		const results = await Promise.all([
			patch({ version: 0, changes: [{ category: "booking", enabled: false }] }),
			patch({ version: 0, changes: [{ category: "weather", enabled: false }] }),
		]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
		const latest = (await get().expect(200)).body;
		expect(latest.version).toBe(1);
		expect(latest.categories.filter((item: { enabled: boolean }) => !item.enabled)).toHaveLength(1);
		const next = await patch({
			version: 1,
			changes: [{ category: "porter_assignment", enabled: false }],
		}).expect(200);
		expect(next.body.version).toBe(2);
		expect(next.body.categories.filter((item: { enabled: boolean }) => !item.enabled)).toHaveLength(
			2
		);
	});

	it("rejects locked and unsupported categories atomically and scopes state to the caller", async () => {
		for (const [category, code] of [
			["sos", "MANDATORY_NOTIFICATION_TYPE"],
			["emergency", "MANDATORY_NOTIFICATION_TYPE"],
			["invalid", "UNSUPPORTED_NOTIFICATION_TYPE"],
		]) {
			const result = await patch({
				version: 2,
				changes: [
					{ category: "booking", enabled: true },
					{ category, enabled: false },
				],
			}).expect(422);
			expect(result.body.code).toBe(code);
		}
		expect((await get().expect(200)).body.version).toBe(2);
		expect((await get(b).expect(200)).body.version).toBe(0);
		await patch({
			version: 2,
			userId: b,
			changes: [{ category: "booking", enabled: true }],
		}).expect(422);
		expect((await get(b).expect(200)).body.version).toBe(0);
	});

	it("re-enables disabled ordinary categories and returns effective weather state", async () => {
		const disabled = await patch({
			version: 2,
			changes: [{ category: "weather", enabled: false }],
		}).expect(200);
		expect(
			disabled.body.categories.find((item: { category: string }) => item.category === "weather")
		).toMatchObject({ enabled: false, effectiveEnabled: false, mandatoryOverride: "red_weather" });
		const enabled = await patch({
			version: 3,
			changes: [{ category: "weather", enabled: true }],
		}).expect(200);
		expect(enabled.body.version).toBe(4);
		expect(
			enabled.body.categories.find((item: { category: string }) => item.category === "weather")
		).toMatchObject({ enabled: true, effectiveEnabled: true });
	});

	it("cascades preferences and their version when an account is deleted", async () => {
		await patch({ version: 0, changes: [{ category: "weather", enabled: false }] }, b).expect(200);
		await db.query("DELETE FROM user_roles WHERE user_id=$1", [b]);
		await db.query("DELETE FROM users WHERE id=$1", [b]);
		expect(
			await db.query("SELECT user_id FROM notification_preferences WHERE user_id=$1", [b])
		).toEqual([]);
		expect(
			await db.query("SELECT user_id FROM notification_preference_versions WHERE user_id=$1", [b])
		).toEqual([]);
	});
});
