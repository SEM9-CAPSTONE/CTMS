import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { SourceFilesService } from "../src/modules/survival-documents/source-files.service";
import { SourceUploadCleanupService } from "../src/modules/survival-documents/source-upload-cleanup.service";
import { SurvivalDocumentsRepository } from "../src/modules/survival-documents/survival-documents.repository";
import {
	Classification,
	DocumentStatus,
	MedicalStatus,
} from "../src/modules/survival-documents/survival-documents.types";
import { SurvivalSourceReader } from "../src/modules/survival-documents/survival-source-reader.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalPdf,
	fictionalRights,
} from "./support/survival-source-fixture";

describe("CTMS-050 PostgreSQL integration + real guarded HTTP", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let reader: SurvivalSourceReader;
	let files: SourceFilesService;
	let root: string;
	const ids = {
		admin: randomUUID(),
		camper: randomUUID(),
		host: randomUUID(),
		porter: randomUUID(),
	};
	const endpoint = "/api/admin/survival-documents";
	const token = (role: keyof typeof ids) => `Bearer ${jwt.sign({ sub: ids[role], roles: [role] })}`;
	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "ctms50-integration-"));
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication();
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
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		reader = module.get(SurvivalSourceReader);
		files = module.get(SourceFilesService);
		await assertSafeTestDatabase(db);
		for (const [role, id] of Object.entries(ids)) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','CTMS50 test')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
	}, 90000);
	afterAll(async () => {
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
	});
	async function create(metadata = fictionalMetadata) {
		return (
			await request(app.getHttpServer())
				.post(endpoint)
				.set("Authorization", token("admin"))
				.field("metadata", JSON.stringify(metadata))
				.attach("file", fictionalPdf, { filename: "fictional.pdf", contentType: "application/pdf" })
				.expect(201)
		).body as SourceTestDetail;
	}
	async function action(
		doc: SourceTestDetail,
		name: string,
		extra: Record<string, unknown> = {},
		status = 201
	) {
		const version = doc.versions[0];
		return request(app.getHttpServer())
			.post(`${endpoint}/${doc.id}/versions/${version.id}/${name}`)
			.set("Authorization", token("admin"))
			.send({ expectedRevision: version.revision, ...extra })
			.expect(status);
	}
	async function approved() {
		let doc = await create();
		doc = (await action(doc, "submit")).body as SourceTestDetail;
		return (await action(doc, "review", { decision: "approve", rights: fictionalRights }))
			.body as SourceTestDetail;
	}
	it("enforces 401/403 on catalog, list, files and every mutating endpoint with zero state change", async () => {
		const doc = await create();
		const file = `${endpoint}/${doc.id}/versions/${doc.versions[0].id}/file`;
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer()).get(file).expect(401);
		for (const role of ["camper", "host", "porter"] as const) {
			for (const url of [endpoint, `${endpoint}/references`, `${endpoint}/${doc.id}`, file])
				await request(app.getHttpServer()).get(url).set("Authorization", token(role)).expect(403);
			for (const name of ["submit", "review", "publish", "archive"])
				await request(app.getHttpServer())
					.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/${name}`)
					.set("Authorization", token(role))
					.send({ expectedRevision: 1 })
					.expect(403);
			await request(app.getHttpServer())
				.post(endpoint)
				.set("Authorization", token(role))
				.expect(403);
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions`)
				.set("Authorization", token(role))
				.expect(403);
			await request(app.getHttpServer())
				.patch(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/metadata`)
				.set("Authorization", token(role))
				.send({ expectedRevision: 1, metadata: fictionalMetadata })
				.expect(403);
		}
		expect(
			(
				await request(app.getHttpServer())
					.get(`${endpoint}/${doc.id}`)
					.set("Authorization", token("admin"))
			).body.versions[0].revision
		).toBe(1);
	});
	it("keeps catalog unreviewed, requires supplied bytes/evidence and rejects spoofed/oversized uploads", async () => {
		const references = await request(app.getHttpServer())
			.get(`${endpoint}/references`)
			.set("Authorization", token("admin"))
			.expect(200);
		expect(references.body.items).toHaveLength(9);
		for (const item of references.body.items) {
			expect(item.reviewStatus).toBe("NOT_REVIEWED");
			expect(item.internalRagUseAllowed).toBe(false);
		}
		for (const change of [
			{ publisher: "" },
			{ sourceUrl: "http://127.0.0.1/file" },
			{ locale: "invalid" },
			{ permissionEvidence: "" },
			{ isApproved: true },
		])
			await request(app.getHttpServer())
				.post(endpoint)
				.set("Authorization", token("admin"))
				.field("metadata", JSON.stringify({ ...fictionalMetadata, ...change }))
				.attach("file", fictionalPdf, "fictional.pdf")
				.expect(422);
		await request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", token("admin"))
			.field("metadata", JSON.stringify(fictionalMetadata))
			.expect(422);
		await request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", token("admin"))
			.field("metadata", JSON.stringify(fictionalMetadata))
			.attach("file", Buffer.from("spoofed"), {
				filename: "fake.pdf",
				contentType: "application/pdf",
			})
			.expect(422);
		await request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", token("admin"))
			.field("metadata", JSON.stringify(fictionalMetadata))
			.attach("file", Buffer.alloc(10485761), {
				filename: "large.pdf",
				contentType: "application/pdf",
			})
			.expect(413);
	});
	it("persists source/checksum privately; edits only draft with stale protection; review and publish gates hold", async () => {
		let doc = await create();
		const original = doc.versions[0];
		expect(original.status).toBe(DocumentStatus.DRAFT);
		expect(original).not.toHaveProperty("fileRef");
		const download = await request(app.getHttpServer())
			.get(`${endpoint}/${doc.id}/versions/${original.id}/file`)
			.set("Authorization", token("admin"))
			.expect(200);
		expect(download.headers["cache-control"]).toContain("no-store");
		expect(download.body).toEqual(fictionalPdf);
		await action(doc, "publish", {}, 409);
		await expect(reader.readPublished(original.id)).rejects.toThrow();
		await expect(reader.resolvePublishedProvenance(original.id)).rejects.toThrow();
		const stale = doc;
		doc = (
			await request(app.getHttpServer())
				.patch(`${endpoint}/${doc.id}/versions/${original.id}/metadata`)
				.set("Authorization", token("admin"))
				.send({
					expectedRevision: 1,
					metadata: { ...fictionalMetadata, changeSummary: "Updated fictional metadata" },
				})
				.expect(200)
		).body as SourceTestDetail;
		await action(stale, "submit", {}, 409);
		doc = (await action(doc, "submit")).body as SourceTestDetail;
		await action(
			doc,
			"review",
			{ decision: "approve", rights: { ...fictionalRights, internalRagUseAllowed: false } },
			422
		);
		await action(doc, "review", { decision: "approve" }, 422);
		doc = (await action(doc, "review", { decision: "approve", rights: fictionalRights }))
			.body as SourceTestDetail;
		await request(app.getHttpServer())
			.patch(`${endpoint}/${doc.id}/versions/${original.id}/metadata`)
			.set("Authorization", token("admin"))
			.send({ expectedRevision: doc.versions[0].revision, metadata: fictionalMetadata })
			.expect(409);
		doc = (await action(doc, "publish")).body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBe(original.id);
		expect((await reader.readPublished(original.id)).manifest.checksum).toBe(original.checksum);
		await expect(reader.readPublished(original.id, "OFFLINE")).rejects.toThrow();
		await expect(
			db.query("UPDATE survival_document_versions SET metadata='{}' WHERE id=$1", [original.id])
		).rejects.toThrow("immutable");
		await expect(
			db.query("UPDATE survival_document_versions SET status='DRAFT' WHERE id=$1", [original.id])
		).rejects.toThrow("lifecycle");
		await expect(
			db.query("DELETE FROM survival_document_versions WHERE id=$1", [original.id])
		).rejects.toThrow();
		expect(doc.history.some((event) => event.action === "survival_document.review")).toBe(true);
	});
	it("retains rejection reason and prevents rejected downstream processing", async () => {
		let doc = await create();
		doc = (await action(doc, "submit")).body as SourceTestDetail;
		await action(doc, "review", { decision: "reject", rights: fictionalRights }, 422);
		doc = (
			await action(doc, "review", {
				decision: "reject",
				rights: fictionalRights,
				reason: "Fictional source lacks permission",
			})
		).body as SourceTestDetail;
		expect(doc.versions[0].reason).toContain("lacks permission");
		await action(doc, "publish", {}, 409);
		await expect(reader.readPublished(doc.versions[0].id)).rejects.toThrow();
	});
	it("allocates versions and publishes concurrently with one winner; keeps old provenance and durable regeneration event", async () => {
		let doc = await approved();
		doc = (await action(doc, "publish")).body as SourceTestDetail;
		const first = doc.versions[0];
		const replacement = () =>
			request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions`)
				.set("Authorization", token("admin"))
				.field("expectedDocumentRevision", String(doc.revision))
				.field(
					"metadata",
					JSON.stringify({ ...fictionalMetadata, changeSummary: "Second fictional edition" })
				)
				.attach("file", fictionalPdf, "fictional-v2.pdf");
		const results = await Promise.all([replacement(), replacement()]);
		expect(results.map((item) => item.status).sort()).toEqual([201, 409]);
		doc = results.find((item) => item.status === 201)?.body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBe(first.id);
		expect(doc.versions[0].versionNumber).toBe(2);
		expect(doc.versions[1].metadata).toEqual(first.metadata);
		doc = (await action(doc, "submit")).body as SourceTestDetail;
		doc = (await action(doc, "review", { decision: "approve", rights: fictionalRights }))
			.body as SourceTestDetail;
		const publish = () =>
			request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/publish`)
				.set("Authorization", token("admin"))
				.send({ expectedRevision: doc.versions[0].revision })
				.then((result) => result.status);
		const published = await Promise.all([publish(), publish()]);
		expect(published.sort()).toEqual([201, 409]);
		const latest = (
			await request(app.getHttpServer())
				.get(`${endpoint}/${doc.id}`)
				.set("Authorization", token("admin"))
		).body as SourceTestDetail;
		expect(latest.versions[1].status).toBe(DocumentStatus.SUPERSEDED);
		expect(latest.versions[1].checksum).toBe(first.checksum);
		await expect(reader.readPublished(first.id)).rejects.toThrow();
		const citation = await reader.resolvePublishedProvenance(first.id);
		expect(citation.checksum).toBe(first.checksum);
		expect(citation.publicationStatus).toBe(DocumentStatus.SUPERSEDED);
		expect(citation.historicalOnly).toBe(true);
		expect(citation).not.toHaveProperty("fileRef");
		const events = await db.query("SELECT * FROM survival_document_outbox WHERE document_id=$1", [
			doc.id,
		]);
		expect(events).toHaveLength(2);
		expect(events[1].payload.regenerationNeeded).toBe(true);
		await action(latest, "archive", {}, 422);
		const archived = (await action(latest, "archive", { reason: "Fictional source withdrawal" }))
			.body as SourceTestDetail;
		expect(archived.currentPublishedVersionId).toBeNull();
		await expect(reader.readPublished(archived.versions[0].id)).rejects.toThrow();
		expect(
			(await reader.resolvePublishedProvenance(archived.versions[0].id)).publicationStatus
		).toBe(DocumentStatus.ARCHIVED);
	});
	it("requires separate medical and translation review and preserves independent offline rights", async () => {
		let medical = await create({ ...fictionalMetadata, classification: Classification.FIRST_AID });
		medical = (await action(medical, "submit")).body as SourceTestDetail;
		await action(medical, "review", { decision: "approve", rights: fictionalRights }, 422);
		medical = (
			await action(medical, "review", {
				decision: "approve",
				rights: {
					...fictionalRights,
					medicalContentReviewStatus: MedicalStatus.APPROVED,
					offlineRedistributionAllowed: true,
				},
			})
		).body as SourceTestDetail;
		medical = (await action(medical, "publish")).body as SourceTestDetail;
		expect(
			(await reader.readPublished(medical.versions[0].id, "OFFLINE")).manifest.rights
				.offlineRedistributionAllowed
		).toBe(true);
		const original = await approved();
		let translation = await create({
			...fictionalMetadata,
			locale: "en",
			originalVersionId: original.versions[0].id,
			adaptationDisclaimer: "Fictional translation by a test author",
		});
		translation = (await action(translation, "submit")).body as SourceTestDetail;
		await action(translation, "review", { decision: "approve", rights: fictionalRights }, 422);
		translation = (
			await action(translation, "review", {
				decision: "approve",
				rights: { ...fictionalRights, translationAllowed: true },
			})
		).body as SourceTestDetail;
		translation = (await action(translation, "publish")).body as SourceTestDetail;
		expect(
			(await reader.readPublished(translation.versions[0].id, "TRANSLATION")).manifest.metadata
				.originalVersionId
		).toBe(original.versions[0].id);
	});
	it("rolls back publication, pointer and outbox together when audit fails", async () => {
		const approvedSource = await approved();
		const repo = app.get(SurvivalDocumentsRepository);
		const audit = jest.spyOn(repo, "audit").mockRejectedValueOnce(new Error("audit unavailable"));
		await action(approvedSource, "publish", {}, 500);
		audit.mockRestore();
		const state = (
			await request(app.getHttpServer())
				.get(`${endpoint}/${approvedSource.id}`)
				.set("Authorization", token("admin"))
		).body as SourceTestDetail;
		expect(state.currentPublishedVersionId).toBeNull();
		expect(state.versions[0].status).toBe(DocumentStatus.APPROVED);
		expect(
			await db.query("SELECT id FROM survival_document_outbox WHERE document_id=$1", [state.id])
		).toEqual([]);
	});
	it("rolls back failed disk/DB writes and retries durable orphan cleanup", async () => {
		const count = await readdir(root);
		const disk = jest.spyOn(files, "write").mockRejectedValueOnce(new Error("disk failed"));
		await request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", token("admin"))
			.field("metadata", JSON.stringify(fictionalMetadata))
			.attach("file", fictionalPdf, "fictional.pdf")
			.expect(503);
		disk.mockRestore();
		expect(await readdir(root)).toHaveLength(count.length);
		const doc = await create();
		const beforeFiles = (await readdir(root)).length;
		const fail = jest.spyOn(db, "transaction").mockRejectedValueOnce(new Error("database failed"));
		await request(app.getHttpServer())
			.post(`${endpoint}/${doc.id}/versions`)
			.set("Authorization", token("admin"))
			.field("expectedDocumentRevision", String(doc.revision))
			.field("metadata", JSON.stringify(fictionalMetadata))
			.attach("file", fictionalPdf, "fictional.pdf")
			.expect(503);
		fail.mockRestore();
		expect(await readdir(root)).toHaveLength(beforeFiles);
		const key = randomUUID();
		await db.query(
			"INSERT INTO survival_document_uploads(file_ref,created_at) VALUES($1,now()-interval '25 hours')",
			[key]
		);
		await files.write(key, fictionalPdf);
		await app.get(SourceUploadCleanupService).cleanup();
		expect(await readdir(root)).toHaveLength(beforeFiles);
	});
});
