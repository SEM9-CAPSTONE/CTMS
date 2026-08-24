import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { CampsiteStatus } from "../src/modules/campsites/entities/campsite.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import {
	CampsiteFixtureTracker,
	cleanupCampsiteFixtures,
	createFixtureCampsite,
	createFixtureHost,
	createFixtureImage,
} from "./support/campsite-fixtures";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Edit Campsite Information PATCH /campsites/:id (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let tracker: CampsiteFixtureTracker;
	let cleanupUserIds: string[];
	let host: TestAccount;
	let camper: TestAccount;

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

	beforeEach(async () => {
		tracker = new CampsiteFixtureTracker();
		cleanupUserIds = [];
		const hostId = await createFixtureHost(dataSource, tracker);
		host = { id: hostId, accessToken: jwtService.sign({ sub: hostId, roles: ["host"] }) };
		camper = await createAccount("camper", "active");
	});

	afterEach(async () => {
		await cleanupCampsiteFixtures(dataSource, tracker);
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
		const email = `e2e-edit-campsite-${role}-${sequence}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, "Edit Campsite Test Account"]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function updateCampsite(token: string | undefined, campsiteId: string, payload: object) {
		const req = request(app.getHttpServer()).patch(`/api/campsites/${campsiteId}`).send(payload);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function searchCampsites(token: string, query: Record<string, unknown>) {
		return request(app.getHttpServer())
			.get("/api/campsites")
			.query(query)
			.set("Authorization", `Bearer ${token}`);
	}

	async function readCampsite(campsiteId: string): Promise<{
		name: string;
		province: string;
		updated_at: Date;
		latitude: number;
		longitude: number;
	}> {
		const rows = (await dataSource.query(
			`SELECT
			   "name",
			   "province",
			   "updated_at",
			   ST_Y("location"::geometry) AS "latitude",
			   ST_X("location"::geometry) AS "longitude"
			 FROM "campsites"
			 WHERE "id" = $1`,
			[campsiteId]
		)) as Array<{
			name: string;
			province: string;
			updated_at: Date;
			latitude: number;
			longitude: number;
		}>;
		return rows[0];
	}

	async function countUpdateAuditLogs(campsiteId: string): Promise<number> {
		const rows = (await dataSource.query(
			`SELECT COUNT(*)::int AS "count"
			   FROM "audit_logs"
			  WHERE "target_id" = $1 AND "action" = 'campsite.updated'`,
			[campsiteId]
		)) as Array<{ count: number }>;
		return rows[0].count;
	}

	it("updates an owned active campsite, records history, and exposes public fields to Campers", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: host.id,
			name: "CTMS11 Old Camp",
			province: "CTMS11-OLD",
			status: CampsiteStatus.ACTIVE,
			latitude: "10.000000",
			longitude: "106.000000",
		});
		await createFixtureImage(dataSource, campsiteId, {
			url: "https://example.com/old-cover.jpg",
			sortOrder: 0,
		});
		const before = await readCampsite(campsiteId);
		const newProvince = `CTMS11-NEW-${Date.now()}`;

		const res = await updateCampsite(host.accessToken, campsiteId, {
			name: "CTMS11 Updated Pine Camp",
			province: newProvince,
			latitude: 11.940419,
			longitude: 108.458313,
			media: [{ url: "https://example.com/new-cover.jpg", type: "photo", sortOrder: 0 }],
			expectedUpdatedAt: before.updated_at.toISOString(),
			changeReason: "host corrected public details",
		}).expect(200);

		expect(res.body).toEqual(
			expect.objectContaining({
				id: campsiteId,
				hostId: host.id,
				name: "CTMS11 Updated Pine Camp",
				province: newProvince,
				latitude: 11.940419,
				longitude: 108.458313,
				status: CampsiteStatus.ACTIVE,
				media: [expect.objectContaining({ url: "https://example.com/new-cover.jpg" })],
			})
		);

		const auditRows = (await dataSource.query(
			`SELECT "actor_id", "before", "after", "reason"
			   FROM "audit_logs"
			  WHERE "target_id" = $1 AND "action" = 'campsite.updated'`,
			[campsiteId]
		)) as Array<{
			actor_id: string;
			before: { name: string; province: string };
			after: { name: string; province: string; media: Array<{ url: string }> };
			reason: string;
		}>;
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0]).toEqual(
			expect.objectContaining({
				actor_id: host.id,
				before: expect.objectContaining({ name: "CTMS11 Old Camp", province: "CTMS11-OLD" }),
				after: expect.objectContaining({
					name: "CTMS11 Updated Pine Camp",
					province: newProvince,
					media: [expect.objectContaining({ url: "https://example.com/new-cover.jpg" })],
				}),
				reason: "host corrected public details",
			})
		);

		const searchRes = await searchCampsites(camper.accessToken, { province: newProvince }).expect(
			200
		);
		expect(searchRes.body.items).toEqual([
			expect.objectContaining({
				id: campsiteId,
				name: "CTMS11 Updated Pine Camp",
				coverImage: "https://example.com/new-cover.jpg",
			}),
		]);
	});

	it("rejects invalid data with 422 and leaves campsite data unchanged", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: host.id,
			name: "CTMS11 Valid Camp",
			province: "CTMS11-UNCHANGED",
		});
		const before = await readCampsite(campsiteId);

		const res = await updateCampsite(host.accessToken, campsiteId, {
			name: " ",
			latitude: 95,
		}).expect(422);

		expect(res.body.statusCode).toBe(422);
		await expect(readCampsite(campsiteId)).resolves.toEqual(before);
		await expect(countUpdateAuditLogs(campsiteId)).resolves.toBe(0);
	});

	it("rejects a non-owning Host with 403 and no side effects", async () => {
		const otherHost = await createAccount("host", "active");
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: host.id,
			name: "CTMS11 Owned Camp",
			province: "CTMS11-OWNER",
		});
		const before = await readCampsite(campsiteId);

		await updateCampsite(otherHost.accessToken, campsiteId, {
			name: "Should Not Persist",
		}).expect(403);

		await expect(readCampsite(campsiteId)).resolves.toEqual(before);
		await expect(countUpdateAuditLogs(campsiteId)).resolves.toBe(0);
	});

	it("rejects stale retries with 409 and rolls back attempted changes", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: host.id,
			name: "CTMS11 Fresh Camp",
			province: "CTMS11-FRESH",
		});
		const before = await readCampsite(campsiteId);

		await dataSource.query(
			`UPDATE "campsites" SET "name" = $1, "updated_at" = NOW() + INTERVAL '1 second' WHERE "id" = $2`,
			["CTMS11 Concurrent Update", campsiteId]
		);
		const afterConcurrentChange = await readCampsite(campsiteId);

		await updateCampsite(host.accessToken, campsiteId, {
			name: "Stale Retry Name",
			province: "CTMS11-STALE",
			expectedUpdatedAt: before.updated_at.toISOString(),
		}).expect(409);

		await expect(readCampsite(campsiteId)).resolves.toEqual(afterConcurrentChange);
		await expect(countUpdateAuditLogs(campsiteId)).resolves.toBe(0);
	});
});
