import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { GuideCardExtraction } from "../src/modules/profiles/entities/porter-verification-document.entity";
import { HttpGuideCardExtractionProvider } from "../src/modules/profiles/providers/guide-card-extraction.provider";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestActor {
	id: string;
	token: string;
}

const PDF = Buffer.from("%PDF-1.7\n% guide certificate\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CARD = { cardType: "noi_dia", cardNumber: "123456789", expiresOn: "2099-01-01" };

/** What the (mocked) AI reads on a card photo; PDFs are never read. */
function reading(fullName: string, overrides: Record<string, unknown> = {}): GuideCardExtraction {
	return {
		status: "read",
		isGuideCard: true,
		fullName,
		cardNumber: CARD.cardNumber,
		cardType: "noi_dia",
		expiresOn: CARD.expiresOn,
		confidence: 0.9,
		model: "test",
		...overrides,
	} as GuideCardExtraction;
}

describe("Porter guide certificate verification (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let extractSpy: jest.SpyInstance;
	const userIds = new Set<string>();

	beforeAll(async () => {
		// Storage is an external boundary (Cloudinary / disk); validation stays real.
		jest
			.spyOn(UploadsService.prototype as never, "uploadToCloudinary" as never)
			.mockImplementation((() =>
				Promise.resolve({
					url: `https://files.test/${randomUUID()}.pdf`,
					key: "porter-verifications/doc",
				})) as never);
		jest
			.spyOn(UploadsService.prototype as never, "uploadToLocalDisk" as never)
			.mockImplementation((() => ({ url: `https://files.test/${randomUUID()}.pdf` })) as never);

		// The AI card reader is an external boundary too; the checks on its reading stay real.
		extractSpy = jest
			.spyOn(HttpGuideCardExtractionProvider.prototype, "extract")
			.mockResolvedValue({ status: "unavailable", code: "not_an_image" });

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

	afterEach(async () => {
		const ids = [...userIds];
		if (ids.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[ids]
			);
			await dataSource.query('DELETE FROM "porter_profiles" WHERE "porter_id" = ANY($1)', [ids]);
			await dataSource.query(
				'UPDATE "porter_verifications" SET "reviewed_by" = NULL WHERE "reviewed_by" = ANY($1)',
				[ids]
			);
			await dataSource.query(
				`UPDATE "porter_verifications" SET "registry_checked_by" = NULL, "registry_checked_at" = NULL
				 WHERE "registry_checked_by" = ANY($1)`,
				[ids]
			);
			await dataSource.query('DELETE FROM "porter_verifications" WHERE "porter_id" = ANY($1)', [
				ids,
			]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [ids]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [ids]);
		}
		userIds.clear();
		extractSpy.mockResolvedValue({ status: "unavailable", code: "not_an_image" });
	});

	afterAll(async () => {
		jest.restoreAllMocks();
		await app.close();
	});

	async function createActor(role: UserRole, fullName: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			`INSERT INTO "users" (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused', $3, 'active', $4)`,
			[id, `porter-verify-${id}@example.com`, role, fullName]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function upload(token: string, content: Buffer, filename: string, contentType: string) {
		return request(app.getHttpServer())
			.post("/api/porter/verification/documents")
			.set("Authorization", `Bearer ${token}`)
			.attach("file", content, { filename, contentType });
	}

	function declareCard(token: string, card: Record<string, unknown> = CARD) {
		return request(app.getHttpServer())
			.put("/api/porter/verification/card")
			.set("Authorization", `Bearer ${token}`)
			.send(card);
	}

	function approve(
		token: string,
		porterId: string,
		body: Record<string, unknown> = { officialRegistryChecked: true }
	) {
		return request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porterId}/approve`)
			.set("Authorization", `Bearer ${token}`)
			.send(body);
	}

	function submit(token: string) {
		return request(app.getHttpServer())
			.post("/api/porter/verification/submit")
			.set("Authorization", `Bearer ${token}`);
	}

	function setAvailable(token: string) {
		return request(app.getHttpServer())
			.patch("/api/porter/profile")
			.set("Authorization", `Bearer ${token}`)
			.send({ availabilityStatus: "available" });
	}

	it("runs upload → card → submit → admin approve and only then allows availability", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Applicant");
		const admin = await createActor(UserRole.ADMIN, "Reviewer");
		extractSpy.mockImplementation(async (_image: Buffer, mimeType: string) =>
			mimeType === "image/png"
				? reading("PORTER APPLICANT")
				: { status: "unavailable", code: "not_an_image" }
		);

		const initial = await request(app.getHttpServer())
			.get("/api/porter/verification")
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(200);
		expect(initial.body).toMatchObject({
			status: "pending_documents",
			version: 0,
			documents: [],
			guideCard: null,
		});

		await submit(porter.token).expect(422);
		await setAvailable(porter.token).expect(403);

		const uploaded = await upload(porter.token, PDF, "chung-chi.pdf", "application/pdf").expect(
			201
		);
		expect(uploaded.body).toMatchObject({
			originalName: "chung-chi.pdf",
			mimeType: "application/pdf",
			sizeBytes: PDF.length,
		});
		await upload(porter.token, PNG, "the.png", "image/png").expect(201);

		// The guide card must be declared first: domestic or international, 9 digits, not expired.
		await submit(porter.token).expect(422);
		await declareCard(porter.token, { ...CARD, cardType: "tai_diem" }).expect(422);
		await declareCard(porter.token, { ...CARD, cardNumber: "12345678" }).expect(422);
		await declareCard(porter.token, { ...CARD, expiresOn: "2000-01-01" }).expect(422);
		const declared = await declareCard(porter.token).expect(200);
		expect(declared.body.guideCard).toEqual(CARD);

		const submitted = await submit(porter.token).expect(200);
		expect(submitted.body).toMatchObject({ status: "pending_review", version: 3, guideCard: CARD });
		expect(submitted.body.documents).toHaveLength(2);

		// Documents are locked while pending review.
		await upload(porter.token, PDF, "late.pdf", "application/pdf").expect(409);
		await request(app.getHttpServer())
			.delete(`/api/porter/verification/documents/${uploaded.body.id}`)
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(409);

		const list = await request(app.getHttpServer())
			.get("/api/admin/porter-verifications")
			.query({ status: "pending_review", search: "Porter Applicant" })
			.set("Authorization", `Bearer ${admin.token}`)
			.expect(200);
		expect(list.body.items).toEqual([
			expect.objectContaining({
				porterId: porter.id,
				status: "pending_review",
				documentCount: 2,
			}),
		]);

		const detail = await request(app.getHttpServer())
			.get(`/api/admin/porter-verifications/${porter.id}`)
			.set("Authorization", `Bearer ${admin.token}`)
			.expect(200);
		expect(detail.body.documents).toHaveLength(2);
		// The photo matched the declaration and the account name: no label.
		expect(detail.body.cardCheck).toMatchObject({
			labels: [],
			autoRejected: false,
			reading: { cardNumber: CARD.cardNumber, cardType: "noi_dia" },
		});
		expect(detail.body.registryCheckedAt).toBeNull();

		// Approval needs the Admin to confirm the official registry check.
		const missing = await approve(admin.token, porter.id, {});
		expect([400, 422]).toContain(missing.status);
		await approve(admin.token, porter.id, { officialRegistryChecked: false }).expect(422);
		const approved = await approve(admin.token, porter.id).expect(200);
		expect(approved.body).toMatchObject({
			status: "approved",
			reviewedBy: admin.id,
			registryCheckedBy: admin.id,
		});
		await approve(admin.token, porter.id).expect(409);

		await setAvailable(porter.token).expect(200);

		const audits = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1 AND "target_type" = $2 ORDER BY "created_at"',
			[porter.id, "porter_verification"]
		);
		expect(audits.map((row: { action: string }) => row.action)).toEqual([
			"porter_verification.card_updated",
			"porter_verification.submitted",
			"porter_verification.approved",
		]);

		// An expired card takes the Porter out of availability again.
		await dataSource.query(
			`UPDATE "porter_verifications" SET "guide_card_expires_on" = '2000-01-01' WHERE "porter_id" = $1`,
			[porter.id]
		);
		await setAvailable(porter.token).expect(403);
	});

	it("auto-rejects a card that is expired or site-only on the photo, and labels mismatches", async () => {
		const expiredCard = await createActor(UserRole.PORTER, "Nguyễn Văn Hết Hạn");
		extractSpy.mockResolvedValue(reading("NGUYỄN VĂN HẾT HẠN", { expiresOn: "2024-01-01" }));
		await upload(expiredCard.token, PNG, "the-het-han.png", "image/png").expect(201);
		await declareCard(expiredCard.token).expect(200);
		const rejected = await submit(expiredCard.token).expect(200);
		expect(rejected.body).toMatchObject({ status: "rejected" });
		expect(rejected.body.rejectionReason).toContain("đã hết hạn (01/01/2024)");
		const audits = await dataSource.query(
			`SELECT "action", "actor_id" AS "actorId" FROM "audit_logs" WHERE "target_id" = $1 ORDER BY "created_at"`,
			[expiredCard.id]
		);
		expect(audits).toContainEqual({ action: "porter_verification.auto_rejected", actorId: null });

		const siteOnly = await createActor(UserRole.PORTER, "Trần Tại Điểm");
		extractSpy.mockResolvedValue(reading("TRẦN TẠI ĐIỂM", { cardType: "tai_diem" }));
		await upload(siteOnly.token, PNG, "the-tai-diem.png", "image/png").expect(201);
		await declareCard(siteOnly.token).expect(200);
		const siteRejected = await submit(siteOnly.token).expect(200);
		expect(siteRejected.body.rejectionReason).toContain("tại điểm");

		const mismatch = await createActor(UserRole.PORTER, "Lê Văn Khai");
		const admin = await createActor(UserRole.ADMIN, "Reviewer");
		extractSpy.mockResolvedValue(reading("PHẠM VĂN KHÁC", { cardNumber: "987654321" }));
		await upload(mismatch.token, PNG, "the-khac.png", "image/png").expect(201);
		await declareCard(mismatch.token).expect(200);
		await submit(mismatch.token).expect(200);
		const detail = await request(app.getHttpServer())
			.get(`/api/admin/porter-verifications/${mismatch.id}`)
			.set("Authorization", `Bearer ${admin.token}`)
			.expect(200);
		expect(detail.body).toMatchObject({
			status: "pending_review",
			cardCheck: { labels: ["NAME_MISMATCH", "NUMBER_MISMATCH"], autoRejected: false },
		});
	});

	it("rejects with a mandatory reason and lets the Porter fix and resubmit", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Rejected");
		const admin = await createActor(UserRole.ADMIN, "Reviewer");
		const first = await upload(porter.token, PDF, "old.pdf", "application/pdf").expect(201);
		await declareCard(porter.token).expect(200);
		const submitted = await submit(porter.token).expect(200);
		// A PDF is not read: the Admin sees that the card could not be checked automatically.
		expect(submitted.body.status).toBe("pending_review");

		await request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porter.id}/reject`)
			.set("Authorization", `Bearer ${admin.token}`)
			.send({ reason: "   " })
			.expect(422);
		await request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porter.id}/reject`)
			.set("Authorization", `Bearer ${admin.token}`)
			.send({ reason: "Chứng chỉ đã hết hạn" })
			.expect(200);

		const mine = await request(app.getHttpServer())
			.get("/api/porter/verification")
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(200);
		expect(mine.body).toMatchObject({
			status: "rejected",
			rejectionReason: "Chứng chỉ đã hết hạn",
		});

		await request(app.getHttpServer())
			.delete(`/api/porter/verification/documents/${first.body.id}`)
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(204);
		await upload(porter.token, PDF, "new.pdf", "application/pdf").expect(201);
		const resubmitted = await submit(porter.token).expect(200);
		expect(resubmitted.body).toMatchObject({ status: "pending_review", rejectionReason: null });
		expect(resubmitted.body.documents.map((d: { originalName: string }) => d.originalName)).toEqual(
			["new.pdf"]
		);
	});

	it("validates files and enforces the five-document limit", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Files");

		await upload(porter.token, Buffer.from("GIF89a"), "a.gif", "image/gif").expect(400);
		await upload(porter.token, Buffer.from("<html>"), "fake.pdf", "application/pdf").expect(400);
		await upload(
			porter.token,
			Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]),
			"big.pdf",
			"application/pdf"
		).expect(413);

		for (let index = 0; index < 5; index += 1) {
			await upload(porter.token, PDF, `doc-${index}.pdf`, "application/pdf").expect(201);
		}
		await upload(porter.token, PDF, "doc-6.pdf", "application/pdf").expect(409);
	});

	it("restricts endpoints by role", async () => {
		const camper = await createActor(UserRole.CAMPER, "Camper");
		const porter = await createActor(UserRole.PORTER, "Porter");

		await request(app.getHttpServer())
			.get("/api/porter/verification")
			.set("Authorization", `Bearer ${camper.token}`)
			.expect(403);
		await request(app.getHttpServer())
			.get("/api/admin/porter-verifications")
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(403);
		await request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porter.id}/approve`)
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(403);
		await request(app.getHttpServer()).get("/api/porter/verification").expect(401);
	});
});
