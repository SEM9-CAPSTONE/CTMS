import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Campsite Media PUT /campsites/:id/media (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let cleanupUserIds: string[] = [];
	let cleanupCampsiteIds: string[] = [];

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
		jwtService = moduleRef.get(JwtService);
	}, 60000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		await app?.close();
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupCampsiteIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) {
			return;
		}
		if (cleanupCampsiteIds.length > 0) {
			await dataSource.query(
				`DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)`,
				[cleanupCampsiteIds, cleanupUserIds]
			);
			await dataSource.query(`DELETE FROM "campsite_media" WHERE "campsite_id" = ANY($1)`, [
				cleanupCampsiteIds,
			]);
			await dataSource.query(`DELETE FROM "campsites" WHERE "id" = ANY($1)`, [cleanupCampsiteIds]);
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query(`DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)`, [
				cleanupUserIds,
			]);
			await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1)`, [
				cleanupUserIds,
			]);
			await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [cleanupUserIds]);
		}
	});

	async function createAccount(
		role: "camper" | "host" | "admin",
		status: "active" | "pending_verification" | "suspended"
	): Promise<TestAccount> {
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const email = `e2e-campsite-media-${role}-${sequence}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, "Campsite Media Test Account"]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createCampsite(hostId: string, name = "Da Lat Pine Camp"): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "campsites" ("host_id", "name", "description", "location", "province", "policies", "operating_hours")
			 VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint(108.458313, 11.940419), 4326)::geography, $4, $5, $6) RETURNING "id"`,
			[
				hostId,
				name,
				"A quiet campsite.",
				"Lam Dong",
				JSON.stringify({ rules: "No noise after 22:00" }),
				JSON.stringify({ opensAt: "08:00", closesAt: "18:00" }),
			]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		cleanupCampsiteIds.push(id);
		return id;
	}

	function updateCampsiteMedia(campsiteId: string, token: string | undefined, payload: object) {
		const req = request(app.getHttpServer())
			.put(`/api/campsites/${campsiteId}/media`)
			.send(payload);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("allows the owning Host to add, delete, and reorder campsite images", async () => {
		const host = await createAccount("host", "active");
		const campsiteId = await createCampsite(host.id);

		// 1. Initial insert (Add images)
		const payload1 = {
			media: [
				{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 },
				{ url: "https://example.com/img2.jpg", type: "photo", sortOrder: 2 },
			],
		};
		const res1 = await updateCampsiteMedia(campsiteId, host.accessToken, payload1).expect(200);
		expect(res1.body).toHaveLength(2);
		expect(res1.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ url: "https://example.com/img1.jpg", sortOrder: 1 }),
				expect.objectContaining({ url: "https://example.com/img2.jpg", sortOrder: 2 }),
			])
		);

		// Verify database state
		let dbMedia = await dataSource.query(
			`SELECT "url", "type", "sort_order" FROM "campsite_media" WHERE "campsite_id" = $1 ORDER BY "sort_order" ASC`,
			[campsiteId]
		);
		expect(dbMedia).toEqual([
			{ url: "https://example.com/img1.jpg", type: "photo", sort_order: 1 },
			{ url: "https://example.com/img2.jpg", type: "photo", sort_order: 2 },
		]);

		// Verify audit log exists
		let auditLogs = await dataSource.query(
			`SELECT "actor_id", "action", "target_type", "target_id", "before", "after"
			   FROM "audit_logs"
			  WHERE "target_id" = $1 AND "action" = 'campsite.media_updated'`,
			[campsiteId]
		);
		expect(auditLogs).toHaveLength(1);
		expect(auditLogs[0].before.media).toHaveLength(0);
		expect(auditLogs[0].after.media).toHaveLength(2);

		// 2. Modify: delete img1, add img3, reorder img2
		const payload2 = {
			media: [
				{ url: "https://example.com/img2.jpg", type: "photo", sortOrder: 5 },
				{ url: "https://example.com/img3.jpg", type: "photo", sortOrder: 1 },
			],
		};
		const res2 = await updateCampsiteMedia(campsiteId, host.accessToken, payload2).expect(200);
		expect(res2.body).toHaveLength(2);
		expect(res2.body[0]).toEqual(
			expect.objectContaining({ url: "https://example.com/img3.jpg", sortOrder: 1 })
		);
		expect(res2.body[1]).toEqual(
			expect.objectContaining({ url: "https://example.com/img2.jpg", sortOrder: 5 })
		);

		// Verify database reflects the deletion and update
		dbMedia = await dataSource.query(
			`SELECT "url", "type", "sort_order" FROM "campsite_media" WHERE "campsite_id" = $1 ORDER BY "sort_order" ASC`,
			[campsiteId]
		);
		expect(dbMedia).toEqual([
			{ url: "https://example.com/img3.jpg", type: "photo", sort_order: 1 },
			{ url: "https://example.com/img2.jpg", type: "photo", sort_order: 5 },
		]);

		// Verify second audit log
		auditLogs = await dataSource.query(
			`SELECT "actor_id", "action", "target_type", "target_id", "before", "after"
			   FROM "audit_logs"
			  WHERE "target_id" = $1 AND "action" = 'campsite.media_updated'
			  ORDER BY "created_at" DESC`,
			[campsiteId]
		);
		expect(auditLogs).toHaveLength(2);
		expect(auditLogs[0].before.media).toHaveLength(2);
		expect(auditLogs[0].after.media).toHaveLength(2);
	});

	it("rejects unauthorized users from modifying campsite images", async () => {
		const hostOwner = await createAccount("host", "active");
		const hostNonOwner = await createAccount("host", "active");
		const camper = await createAccount("camper", "active");

		const campsiteId = await createCampsite(hostOwner.id);
		const payload = {
			media: [{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 }],
		};

		// 1. Unauthenticated (no token) -> 401
		await updateCampsiteMedia(campsiteId, undefined, payload).expect(401);

		// 2. Non-owner Host -> 403
		await updateCampsiteMedia(campsiteId, hostNonOwner.accessToken, payload).expect(403);

		// 3. Camper role -> 403
		await updateCampsiteMedia(campsiteId, camper.accessToken, payload).expect(403);
	});

	it("rejects inactive users from using the endpoint", async () => {
		const host = await createAccount("host", "active");
		const suspendedHost = await createAccount("host", "suspended");

		const campsiteId = await createCampsite(host.id);
		const payload = {
			media: [{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 }],
		};

		// Suspended Host -> 401 (BR-202)
		await updateCampsiteMedia(campsiteId, suspendedHost.accessToken, payload).expect(401);
	});

	it("returns 404 if the campsite does not exist", async () => {
		const host = await createAccount("host", "active");
		const nonExistentCampsiteId = "99999999-9999-9999-9999-999999999999";
		const payload = {
			media: [{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 }],
		};

		await updateCampsiteMedia(nonExistentCampsiteId, host.accessToken, payload).expect(404);
	});

	it("returns 422 if the campsite ID is not a valid UUID format", async () => {
		const host = await createAccount("host", "active");
		const payload = {
			media: [{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 }],
		};

		await updateCampsiteMedia("not-a-uuid", host.accessToken, payload).expect(422);
	});

	it("rejects invalid input payloads with 422", async () => {
		const host = await createAccount("host", "active");
		const campsiteId = await createCampsite(host.id);

		// 1. Empty media array
		await updateCampsiteMedia(campsiteId, host.accessToken, { media: [] }).expect(422);

		// 2. Duplicate sortOrder
		await updateCampsiteMedia(campsiteId, host.accessToken, {
			media: [
				{ url: "https://example.com/img1.jpg", type: "photo", sortOrder: 1 },
				{ url: "https://example.com/img2.jpg", type: "photo", sortOrder: 1 },
			],
		}).expect(422);

		// 3. Invalid URL
		await updateCampsiteMedia(campsiteId, host.accessToken, {
			media: [{ url: "not-a-valid-url", type: "photo", sortOrder: 1 }],
		}).expect(422);
	});
});
