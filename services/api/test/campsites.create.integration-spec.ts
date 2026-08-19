import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { CampsiteStatus } from "../src/modules/campsites/entities/campsite.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

interface CreateCampsitePayload {
	name: string;
	description: string;
	latitude: number;
	longitude: number;
	province: string;
	city: string;
	policies: string;
	operatingHours: string;
	initialImages: Array<{
		url: string;
		type?: "photo";
		displayOrder?: number;
	}>;
}

describe("Create Campsite POST /campsites (integration, real Postgres)", () => {
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
	});

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
			await dataSource.query(`DELETE FROM "campsite_images" WHERE "campsite_id" = ANY($1)`, [
				cleanupCampsiteIds,
			]);
			await dataSource.query(`DELETE FROM "zones" WHERE "campsite_id" = ANY($1)`, [
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
		const email = `e2e-create-campsite-${role}-${sequence}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, "Create Campsite Test Account"]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function validPayload(overrides: Partial<CreateCampsitePayload> = {}): CreateCampsitePayload {
		return {
			name: `CTMS10 Pine Camp ${Date.now()}`,
			description: "A quiet campsite prepared for guided trekking stays.",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lam Dong",
			city: "Da Lat",
			policies: "No campfires after 21:00. Pack out all trash.",
			operatingHours: "08:00-18:00",
			initialImages: [
				{ url: "https://example.com/campsites/pine-cover.jpg", type: "photo", displayOrder: 1 },
				{ url: "https://example.com/campsites/pine-map.jpg", type: "photo", displayOrder: 2 },
			],
			...overrides,
		};
	}

	function createCampsite(token: string | undefined, payload: object) {
		const req = request(app.getHttpServer()).post("/api/campsites").send(payload);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	async function countCampsitesForHost(hostId: string): Promise<number> {
		const rows = (await dataSource.query(
			`SELECT COUNT(*)::int AS "count" FROM "campsites" WHERE "host_id" = $1`,
			[hostId]
		)) as Array<{ count: number }>;
		return rows[0].count;
	}

	it("creates a Draft campsite with initial images and an audit log for an authenticated Host", async () => {
		const host = await createAccount("host", "active");
		const payload = validPayload();

		const res = await createCampsite(host.accessToken, payload).expect(201);
		cleanupCampsiteIds.push(res.body.id);

		expect(res.body).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				hostId: host.id,
				name: payload.name,
				description: payload.description,
				latitude: payload.latitude,
				longitude: payload.longitude,
				province: payload.province,
				city: payload.city,
				policies: payload.policies,
				operatingHours: payload.operatingHours,
				status: CampsiteStatus.DRAFT,
				images: [
					expect.objectContaining({
						url: "https://example.com/campsites/pine-cover.jpg",
						type: "photo",
						displayOrder: 1,
					}),
					expect.objectContaining({
						url: "https://example.com/campsites/pine-map.jpg",
						type: "photo",
						displayOrder: 2,
					}),
				],
			})
		);

		const campsiteRows = (await dataSource.query(
			`SELECT "host_id", "status", "operating_hours" FROM "campsites" WHERE "id" = $1`,
			[res.body.id]
		)) as Array<{ host_id: string; status: CampsiteStatus; operating_hours: string }>;
		expect(campsiteRows).toEqual([
			{
				host_id: host.id,
				status: CampsiteStatus.DRAFT,
				operating_hours: "08:00-18:00",
			},
		]);

		const imageRows = (await dataSource.query(
			`SELECT "url", "type", "display_order" FROM "campsite_images" WHERE "campsite_id" = $1 ORDER BY "display_order" ASC`,
			[res.body.id]
		)) as Array<{ url: string; type: string; display_order: number }>;
		expect(imageRows).toEqual([
			{
				url: "https://example.com/campsites/pine-cover.jpg",
				type: "photo",
				display_order: 1,
			},
			{
				url: "https://example.com/campsites/pine-map.jpg",
				type: "photo",
				display_order: 2,
			},
		]);

		const auditRows = (await dataSource.query(
			`SELECT "actor_id", "action", "target_type", "target_id", "after", "reason"
			   FROM "audit_logs"
			  WHERE "target_id" = $1`,
			[res.body.id]
		)) as Array<{
			actor_id: string;
			action: string;
			target_type: string;
			target_id: string;
			after: { status: CampsiteStatus };
			reason: string;
		}>;
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0]).toEqual(
			expect.objectContaining({
				actor_id: host.id,
				action: "campsite.created",
				target_type: "campsite",
				target_id: res.body.id,
				after: expect.objectContaining({ status: CampsiteStatus.DRAFT }),
				reason: "host_create_campsite",
			})
		);
	});

	it("rejects invalid campsite data with 422 and creates no side effects", async () => {
		const host = await createAccount("host", "active");
		const before = await countCampsitesForHost(host.id);

		const res = await createCampsite(host.accessToken, {
			...validPayload(),
			name: " ",
			latitude: 95,
			operatingHours: "18:00-08:00",
			initialImages: [{ url: "not-a-url" }],
		}).expect(422);

		expect(res.body.statusCode).toBe(422);
		await expect(countCampsitesForHost(host.id)).resolves.toBe(before);
	});

	it("rejects a request with no token before persistence", async () => {
		const res = await createCampsite(undefined, validPayload()).expect(401);
		expect(res.body.statusCode).toBe(401);
	});

	it("rejects authenticated non-Host roles with 403 and no side effects", async () => {
		const camper = await createAccount("camper", "active");

		await createCampsite(camper.accessToken, validPayload()).expect(403);

		await expect(countCampsitesForHost(camper.id)).resolves.toBe(0);
	});

	it("rejects a Host whose account is not active with 401 and no side effects", async () => {
		const pendingHost = await createAccount("host", "pending_verification");

		await createCampsite(pendingHost.accessToken, validPayload()).expect(401);

		await expect(countCampsitesForHost(pendingHost.id)).resolves.toBe(0);
	});
});
