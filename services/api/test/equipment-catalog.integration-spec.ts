import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface TestAccount {
	id: string;
	accessToken: string;
}

/**
 * CTMS-39-T01. Real Postgres, no mocking -- mirrors
 * trips.create.integration-spec.ts's own fixture style. Covers the
 * Host-owned equipment catalog CRUD (`equipment-catalog` module); does not
 * touch `equipment_reservations`/availability math, which is CTMS-40/41's
 * job and out of scope here.
 */
describe("Equipment Catalog (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let cleanupUserIds: string[] = [];
	let cleanupItemIds: string[] = [];

	beforeAll(async () => {
		jest.setTimeout(60000);
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
		await assertSafeTestDatabase(dataSource);
	}, 60000);

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupItemIds = [];
	});

	afterEach(async () => {
		if (cleanupItemIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				cleanupItemIds,
			]);
			await dataSource.query('DELETE FROM "equipment_catalog_items" WHERE "id" = ANY($1)', [
				cleanupItemIds,
			]);
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[cleanupUserIds]
			);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
		}
	});

	async function createAccount(role: UserRole): Promise<TestAccount> {
		const id = randomUUID();
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`
			INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[
				id,
				`e2e-equipment-catalog-${role}-${sequence}@example.com`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
				`Equipment Catalog ${role}`,
			]
		);
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
			 ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);

		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function createPayload() {
		return {
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
			maintenanceSchedule: "Check zippers monthly",
		};
	}

	function createItem(token: string | undefined, body: object = createPayload()) {
		const req = request(app.getHttpServer()).post("/api/equipment-catalog");
		return token ? req.set("Authorization", `Bearer ${token}`).send(body) : req.send(body);
	}

	function listMine(token: string | undefined) {
		const req = request(app.getHttpServer()).get("/api/equipment-catalog/mine");
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function getItem(token: string | undefined, itemId: string) {
		const req = request(app.getHttpServer()).get(`/api/equipment-catalog/${itemId}`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	function updateItem(token: string | undefined, itemId: string, body: object) {
		const req = request(app.getHttpServer()).patch(`/api/equipment-catalog/${itemId}`);
		return token ? req.set("Authorization", `Bearer ${token}`).send(body) : req.send(body);
	}

	it("creates a new catalog item owned by the Host, defaulting status to active, and audits it", async () => {
		const host = await createAccount(UserRole.HOST);

		const response = await createItem(host.accessToken).expect(201);
		cleanupItemIds.push(response.body.id);

		expect(response.body).toMatchObject({
			hostId: host.id,
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
			status: "active",
			maintenanceSchedule: "Check zippers monthly",
		});

		const rows = await dataSource.query(
			'SELECT "host_id" AS "hostId", "status" FROM "equipment_catalog_items" WHERE "id" = $1',
			[response.body.id]
		);
		expect(rows[0]).toMatchObject({ hostId: host.id, status: "active" });

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[response.body.id, "equipment_catalog_item.created"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].actor_id).toBe(host.id);
	});

	it("requires authentication and Host role, with no side effect for a non-host attempt", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		const beforeRows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "equipment_catalog_items"'
		);

		await createItem(undefined).expect(401);
		await createItem(camper.accessToken).expect(403);

		const afterRows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "equipment_catalog_items"'
		);
		expect(afterRows[0].count).toBe(beforeRows[0].count);
	});

	it("rejects invalid catalog data without creating a record", async () => {
		const host = await createAccount(UserRole.HOST);
		const beforeRows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "equipment_catalog_items"'
		);

		await createItem(host.accessToken, { ...createPayload(), quantityTotal: -1 }).expect(422);
		await createItem(host.accessToken, { ...createPayload(), name: "   " }).expect(422);
		await createItem(host.accessToken, { ...createPayload(), status: "active" }).expect(422);

		const afterRows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "equipment_catalog_items"'
		);
		expect(afterRows[0].count).toBe(beforeRows[0].count);
	});

	it("lists only the requesting Host's own items", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const mine = await createItem(host.accessToken).expect(201);
		cleanupItemIds.push(mine.body.id);
		const theirs = await createItem(otherHost.accessToken).expect(201);
		cleanupItemIds.push(theirs.body.id);

		const response = await listMine(host.accessToken).expect(200);

		const ids = response.body.map((item: { id: string }) => item.id);
		expect(ids).toContain(mine.body.id);
		expect(ids).not.toContain(theirs.body.id);
	});

	it("returns 404 for a missing item and 403 for a different Host, but allows Admin", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const created = await createItem(host.accessToken).expect(201);
		cleanupItemIds.push(created.body.id);

		await getItem(host.accessToken, randomUUID()).expect(404);
		await getItem(otherHost.accessToken, created.body.id).expect(403);
		await getItem(admin.accessToken, created.body.id).expect(200);
	});

	it("updates only the supplied fields for the owning Host, and audits before/after", async () => {
		const host = await createAccount(UserRole.HOST);
		const created = await createItem(host.accessToken).expect(201);
		cleanupItemIds.push(created.body.id);

		const response = await updateItem(host.accessToken, created.body.id, {
			quantityTotal: 5,
			status: "inactive",
		}).expect(200);

		expect(response.body).toMatchObject({
			quantityTotal: 5,
			status: "inactive",
			name: "4-person tent",
		});

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[created.body.id, "equipment_catalog_item.updated"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].before).toMatchObject({ quantityTotal: 10, status: "active" });
		expect(auditRows[0].after).toMatchObject({ quantityTotal: 5, status: "inactive" });
	});

	it("rejects an update from a different Host, with zero side effects", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const created = await createItem(host.accessToken).expect(201);
		cleanupItemIds.push(created.body.id);

		await updateItem(otherHost.accessToken, created.body.id, { quantityTotal: 1 }).expect(403);

		const rows = await dataSource.query(
			'SELECT "quantity_total" AS "quantityTotal" FROM "equipment_catalog_items" WHERE "id" = $1',
			[created.body.id]
		);
		expect(rows[0].quantityTotal).toBe(10);
	});
});
