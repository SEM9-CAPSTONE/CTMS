import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestActor {
	id: string;
	token: string;
}

const PDF = Buffer.from("%PDF-1.7\n% guide certificate\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Porter guide certificate verification (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
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
			await dataSource.query('DELETE FROM "porter_verifications" WHERE "porter_id" = ANY($1)', [
				ids,
			]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [ids]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [ids]);
		}
		userIds.clear();
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

	it("runs upload → submit → admin approve and only then allows availability", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Applicant");
		const admin = await createActor(UserRole.ADMIN, "Reviewer");

		const initial = await request(app.getHttpServer())
			.get("/api/porter/verification")
			.set("Authorization", `Bearer ${porter.token}`)
			.expect(200);
		expect(initial.body).toMatchObject({ status: "pending_documents", version: 0, documents: [] });

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

		const submitted = await submit(porter.token).expect(200);
		expect(submitted.body).toMatchObject({ status: "pending_review", version: 2 });
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

		const approved = await request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porter.id}/approve`)
			.set("Authorization", `Bearer ${admin.token}`)
			.expect(200);
		expect(approved.body).toMatchObject({ status: "approved", reviewedBy: admin.id });
		await request(app.getHttpServer())
			.patch(`/api/admin/porter-verifications/${porter.id}/approve`)
			.set("Authorization", `Bearer ${admin.token}`)
			.expect(409);

		await setAvailable(porter.token).expect(200);

		const audits = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1 AND "target_type" = $2 ORDER BY "created_at"',
			[porter.id, "porter_verification"]
		);
		expect(audits.map((row: { action: string }) => row.action)).toEqual([
			"porter_verification.submitted",
			"porter_verification.approved",
		]);
	});

	it("rejects with a mandatory reason and lets the Porter fix and resubmit", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Rejected");
		const admin = await createActor(UserRole.ADMIN, "Reviewer");
		const first = await upload(porter.token, PDF, "old.pdf", "application/pdf").expect(201);
		await submit(porter.token).expect(200);

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
