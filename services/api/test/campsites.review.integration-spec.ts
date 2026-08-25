import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { ReviewCampsiteAction } from "../src/modules/campsites/dto/review-campsite.dto";
import { CampsiteStatus } from "../src/modules/campsites/entities/campsite.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import {
	CampsiteFixtureTracker,
	cleanupCampsiteFixtures,
	createFixtureCampsite,
} from "./support/campsite-fixtures";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Approve/Decline Campsite PATCH /campsites/:id/review (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let tracker: CampsiteFixtureTracker;
	let cleanupUserIds: string[] = [];
	let adminAccount: TestAccount;
	let hostAccount: TestAccount;
	let camperAccount: TestAccount;

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

		// Create standard test accounts
		adminAccount = await createAccount("admin", "active");
		hostAccount = await createAccount("host", "active");
		camperAccount = await createAccount("camper", "active");
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
		const email = `e2e-review-campsite-${role}-${sequence}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, "Review Campsite Test Account"]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function reviewCampsite(campsiteId: string, token: string | undefined, payload: object) {
		const req = request(app.getHttpServer())
			.patch(`/api/campsites/${campsiteId}/review`)
			.send(payload);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	async function getCampsiteStatusFromDb(id: string): Promise<string> {
		const rows = (await dataSource.query(`SELECT "status" FROM "campsites" WHERE "id" = $1`, [
			id,
		])) as Array<{ status: string }>;
		return rows[0]?.status;
	}

	it("allows an Admin to approve a campsite in pending_approval status", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		const res = await reviewCampsite(campsiteId, adminAccount.accessToken, {
			action: ReviewCampsiteAction.APPROVE,
		}).expect(200);

		expect(res.body.status).toBe(CampsiteStatus.ACTIVE);
		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(CampsiteStatus.ACTIVE);

		// Verify audit log
		const auditRows = (await dataSource.query(
			`SELECT "action", "actor_id", "target_id", "before", "after", "reason"
			 FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2`,
			[campsiteId, "campsite.approved"]
		)) as Array<{
			action: string;
			actor_id: string;
			target_id: string;
			before: { status: string };
			after: { status: string };
			reason: string | null;
		}>;

		expect(auditRows).toHaveLength(1);
		expect(auditRows[0]).toEqual(
			expect.objectContaining({
				action: "campsite.approved",
				actor_id: adminAccount.id,
				target_id: campsiteId,
				reason: null,
			})
		);
		expect(auditRows[0].before.status).toBe(CampsiteStatus.PENDING_APPROVAL);
		expect(auditRows[0].after.status).toBe(CampsiteStatus.ACTIVE);
	});

	it("allows an Admin to decline a campsite in pending_approval status with a reason", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		const declineReason = "Safety issues regarding stream zone terrain";
		const res = await reviewCampsite(campsiteId, adminAccount.accessToken, {
			action: ReviewCampsiteAction.DECLINE,
			reason: declineReason,
		}).expect(200);

		expect(res.body.status).toBe(CampsiteStatus.DRAFT);
		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(CampsiteStatus.DRAFT);

		// Verify audit log
		const auditRows = (await dataSource.query(
			`SELECT "action", "actor_id", "target_id", "before", "after", "reason"
			 FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2`,
			[campsiteId, "campsite.declined"]
		)) as Array<{
			action: string;
			actor_id: string;
			target_id: string;
			before: { status: string };
			after: { status: string };
			reason: string | null;
		}>;

		expect(auditRows).toHaveLength(1);
		expect(auditRows[0]).toEqual(
			expect.objectContaining({
				action: "campsite.declined",
				actor_id: adminAccount.id,
				target_id: campsiteId,
				reason: declineReason,
			})
		);
		expect(auditRows[0].before.status).toBe(CampsiteStatus.PENDING_APPROVAL);
		expect(auditRows[0].after.status).toBe(CampsiteStatus.DRAFT);
	});

	it("returns 422 if Admin declines without providing a reason", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		const res = await reviewCampsite(campsiteId, adminAccount.accessToken, {
			action: ReviewCampsiteAction.DECLINE,
		}).expect(422);

		expect(res.body.statusCode).toBe(422);
		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(
			CampsiteStatus.PENDING_APPROVAL
		);

		// Verify no audit log is created
		const auditRows = await dataSource.query(`SELECT * FROM "audit_logs" WHERE "target_id" = $1`, [
			campsiteId,
		]);
		expect(auditRows).toHaveLength(0);
	});

	it("returns 403 if a Host tries to review the campsite", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		await reviewCampsite(campsiteId, hostAccount.accessToken, {
			action: ReviewCampsiteAction.APPROVE,
		}).expect(403);

		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(
			CampsiteStatus.PENDING_APPROVAL
		);
	});

	it("returns 403 if a Camper tries to review the campsite", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		await reviewCampsite(campsiteId, camperAccount.accessToken, {
			action: ReviewCampsiteAction.APPROVE,
		}).expect(403);

		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(
			CampsiteStatus.PENDING_APPROVAL
		);
	});

	it("returns 401 if request is unauthenticated", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.PENDING_APPROVAL,
		});

		await reviewCampsite(campsiteId, undefined, {
			action: ReviewCampsiteAction.APPROVE,
		}).expect(401);

		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(
			CampsiteStatus.PENDING_APPROVAL
		);
	});

	it("returns 409 if campsite is not in pending_approval status", async () => {
		const campsiteId = await createFixtureCampsite(dataSource, tracker, {
			hostId: hostAccount.id,
			status: CampsiteStatus.ACTIVE,
		});

		const res = await reviewCampsite(campsiteId, adminAccount.accessToken, {
			action: ReviewCampsiteAction.DECLINE,
			reason: "Change back to draft please",
		}).expect(409);

		expect(res.body.message).toContain("Only campsites in pending_approval status can be reviewed");
		await expect(getCampsiteStatusFromDb(campsiteId)).resolves.toBe(CampsiteStatus.ACTIVE);
	});

	it("returns 404 if campsite ID does not exist", async () => {
		const nonExistentId = "00000000-0000-0000-0000-000000000000";

		await reviewCampsite(nonExistentId, adminAccount.accessToken, {
			action: ReviewCampsiteAction.APPROVE,
		}).expect(404);
	});
});
