import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { ManageSurvivalDocuments1793500000000 } from "../src/migrations/1793500000000-ManageSurvivalDocuments";
import { RefactorSurvivalDocumentLifecycle1793600000000 } from "../src/migrations/1793600000000-RefactorSurvivalDocumentLifecycle";
import { IndexSurvivalDocumentChecksum1793700000000 } from "../src/migrations/1793700000000-IndexSurvivalDocumentChecksum";
import { IndexSurvivalDocumentFilename1793800000000 } from "../src/migrations/1793800000000-IndexSurvivalDocumentFilename";
import { AppModule } from "../src/modules/app.module";
import { validatePdf } from "../src/modules/survival-documents/pdf-file-validator";
import { PdfSourceService } from "../src/modules/survival-documents/pdf-source.service";
import { SourceFilesService } from "../src/modules/survival-documents/source-files.service";
import { SourceUploadCleanupService } from "../src/modules/survival-documents/source-upload-cleanup.service";
import { SurvivalDocumentsRepository } from "../src/modules/survival-documents/survival-documents.repository";
import {
	Classification,
	DocumentStatus,
	MedicalStatus,
	RightsStatus,
} from "../src/modules/survival-documents/survival-documents.types";
import { SurvivalSourceReader } from "../src/modules/survival-documents/survival-source-reader.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalPdf,
	fictionalRights,
	uniqueFictionalPdf,
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
	function uploadPdf(bytes: Buffer, metadata = fictionalMetadata, filename = "fictional.pdf") {
		return request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", token("admin"))
			.field("metadata", JSON.stringify(metadata))
			.attach("file", bytes, { filename, contentType: "application/pdf" });
	}
	async function create(
		metadata = fictionalMetadata,
		bytes = uniqueFictionalPdf(),
		filename = `fictional-${randomUUID()}.pdf`
	) {
		return (await uploadPdf(bytes, metadata, filename).expect(201)).body as SourceTestDetail;
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
	it("permanently deletes the document and all versions, preserves audit, and releases its PDF keys", async () => {
		const bytes = uniqueFictionalPdf();
		const filename = `delete-${randomUUID()}.pdf`;
		const draft = await create(fictionalMetadata, bytes, filename);
		const published = (await action(draft, "publish")).body as SourceTestDetail;
		const doc = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${draft.id}/versions`)
				.set("Authorization", token("admin"))
				.field("expectedDocumentRevision", String(published.revision))
				.field("metadata", JSON.stringify(fictionalMetadata))
				.attach("file", uniqueFictionalPdf(), `delete-v2-${randomUUID()}.pdf`)
				.expect(201)
		).body as SourceTestDetail;
		const fileRefs: Array<{ file_ref: string }> = await db.query(
			"SELECT file_ref FROM survival_document_versions WHERE document_id=$1",
			[doc.id]
		);
		const target = `${endpoint}/${doc.id}?expectedRevision=${doc.revision}`;
		await request(app.getHttpServer()).delete(target).expect(401);
		await request(app.getHttpServer())
			.delete(target)
			.set("Authorization", token("camper"))
			.expect(403);
		await request(app.getHttpServer())
			.delete(`${endpoint}/${doc.id}?expectedRevision=${published.revision}`)
			.set("Authorization", token("admin"))
			.expect(409);
		await request(app.getHttpServer())
			.delete(target)
			.set("Authorization", token("admin"))
			.expect(204);
		await request(app.getHttpServer())
			.get(`${endpoint}/${doc.id}`)
			.set("Authorization", token("admin"))
			.expect(404);
		expect(await db.query("SELECT id FROM survival_documents WHERE id=$1", [doc.id])).toEqual([]);
		expect(
			await db.query("SELECT id FROM survival_document_versions WHERE document_id=$1", [doc.id])
		).toEqual([]);
		const storedRefs = fileRefs.map((row) => row.file_ref);
		expect(
			await db.query(
				"SELECT file_ref FROM survival_document_uploads WHERE file_ref=ANY($1::uuid[])",
				[storedRefs]
			)
		).toEqual([]);
		const storedFiles = await readdir(root);
		expect(storedRefs.some((ref) => storedFiles.includes(ref))).toBe(false);
		expect(
			await db.query(
				"SELECT actor_id FROM audit_logs WHERE target_id=$1 AND action='survival_document.delete'",
				[doc.id]
			)
		).toEqual([{ actor_id: ids.admin }]);
		expect(
			await db.query(
				"SELECT event_type FROM survival_document_outbox WHERE document_id=$1 AND event_type='document_deleted'",
				[doc.id]
			)
		).toEqual([{ event_type: "document_deleted" }]);
		await uploadPdf(bytes, fictionalMetadata, filename).expect(201);
	});

	it("keeps documents and files when another document references a version", async () => {
		const draft = await create();
		const original = (await action(draft, "publish")).body as SourceTestDetail;
		await create({
			...fictionalMetadata,
			locale: "en",
			originalVersionId: original.versions[0].id,
			adaptationDisclaimer: "Fictional translation from the original source.",
		});
		const result = await request(app.getHttpServer())
			.delete(`${endpoint}/${original.id}?expectedRevision=${original.revision}`)
			.set("Authorization", token("admin"))
			.expect(409);
		expect(result.body).toMatchObject({ code: "SOURCE_DELETE_REFERENCED" });
		expect(
			await db.query("SELECT current_published_version_id FROM survival_documents WHERE id=$1", [
				original.id,
			])
		).toEqual([{ current_published_version_id: original.versions[0].id }]);
		await request(app.getHttpServer())
			.get(`${endpoint}/${original.id}/versions/${original.versions[0].id}/file`)
			.set("Authorization", token("admin"))
			.expect(200);
	});
	it("enforces 401/403 on list, files and every mutating endpoint with zero state change", async () => {
		const doc = await create();
		const file = `${endpoint}/${doc.id}/versions/${doc.versions[0].id}/file`;
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer()).get(file).expect(401);
		for (const role of ["camper", "host", "porter"] as const) {
			for (const url of [endpoint, `${endpoint}/${doc.id}`, file])
				await request(app.getHttpServer()).get(url).set("Authorization", token(role)).expect(403);
			for (const name of ["publish", "archive"])
				await request(app.getHttpServer())
					.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/${name}`)
					.set("Authorization", token(role))
					.send({ expectedRevision: 1 })
					.expect(403);
			for (const url of [
				endpoint,
				`${endpoint}/import-url`,
				`${endpoint}/${doc.id}/versions`,
				`${endpoint}/${doc.id}/versions/import-url`,
			]) {
				await request(app.getHttpServer()).post(url).set("Authorization", token(role)).expect(403);
			}
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
	it("removes catalog and review endpoints and rejects invalid drafts and uploads", async () => {
		await request(app.getHttpServer())
			.get(`${endpoint}/references`)
			.set("Authorization", token("admin"))
			.expect(422);
		const doc = await create({
			sourceTitle: fictionalMetadata.sourceTitle,
			classification: fictionalMetadata.classification,
			locale: fictionalMetadata.locale,
		});
		expect(doc.versions[0].status).toBe(DocumentStatus.DRAFT);
		for (const removedAction of ["submit", "review"]) await action(doc, removedAction, {}, 404);
		await action(doc, "publish", { rights: fictionalRights }, 422);
		for (const change of [
			{ sourceTitle: "" },
			{ sourceUrl: "http://127.0.0.1/file" },
			{ locale: "invalid" },
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
	it("imports direct PDF URLs as private drafts and enforces the revision on replacement", async () => {
		const sourceUrl = "https://example.org/manual";
		const metadata = {
			sourceTitle: fictionalMetadata.sourceTitle,
			classification: fictionalMetadata.classification,
			locale: fictionalMetadata.locale,
		};
		const bytes = uniqueFictionalPdf();
		const parsedPdf = await validatePdf(bytes, `fictional-${randomUUID()}.pdf`);
		const acquisition = jest.spyOn(app.get(PdfSourceService), "fromUrl").mockResolvedValue({
			...parsedPdf,
			bytes,
		});
		try {
			const doc = (
				await request(app.getHttpServer())
					.post(`${endpoint}/import-url`)
					.set("Authorization", token("admin"))
					.send({ sourceUrl, metadata })
					.expect(201)
			).body as SourceTestDetail;
			expect(acquisition).toHaveBeenCalledWith(sourceUrl);
			expect(doc.currentPublishedVersionId).toBeNull();
			expect(doc.versions[0]).toMatchObject({
				status: DocumentStatus.DRAFT,
				checksum: parsedPdf.checksum,
				metadata: { ...metadata, sourceUrl },
				rights: { internalRagUseAllowed: false, offlineRedistributionAllowed: false },
			});
			const original = await request(app.getHttpServer())
				.get(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/file`)
				.set("Authorization", token("admin"))
				.expect(200);
			expect(original.body).toEqual(bytes);
			const importVersion = () =>
				request(app.getHttpServer())
					.post(`${endpoint}/${doc.id}/versions/import-url`)
					.set("Authorization", token("admin"))
					.send({ sourceUrl, metadata, expectedDocumentRevision: doc.revision });
			const updatedBytes = uniqueFictionalPdf();
			acquisition.mockResolvedValueOnce({
				...(await validatePdf(updatedBytes, `fictional-${randomUUID()}-v2.pdf`)),
				bytes: updatedBytes,
			});
			const replacement = (await importVersion().expect(201)).body as SourceTestDetail;
			expect(replacement.versions.map((version) => version.versionNumber)).toEqual([2, 1]);
			const duplicate = await importVersion().expect(409);
			expect(duplicate.body).toMatchObject({
				code: "SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT",
				versionId: doc.versions[0].id,
			});
			const staleBytes = uniqueFictionalPdf();
			acquisition.mockResolvedValueOnce({
				...(await validatePdf(staleBytes, `fictional-${randomUUID()}-stale.pdf`)),
				bytes: staleBytes,
			});
			const stale = await importVersion().expect(409);
			expect(stale.body).toMatchObject({ code: "SOURCE_CONFLICT" });
			const published = (await action(replacement, "publish", {})).body as SourceTestDetail;
			expect(published.processingSyncStatus).toBe("NOT_PROCESSED");
			expect(published.versions[0]).toMatchObject({
				status: DocumentStatus.PUBLISHED,
				rights: { internalRagUseAllowed: false, offlineRedistributionAllowed: false },
			});
			await expect(reader.readPublished(published.versions[0].id)).rejects.toThrow();
			await expect(reader.readPublished(published.versions[0].id, "OFFLINE")).rejects.toThrow();
			await expect(reader.readPublished(published.versions[0].id, "TRANSLATION")).rejects.toThrow();
			const [event] = await db.query(
				"SELECT payload FROM survival_document_outbox WHERE version_id=$1",
				[published.versions[0].id]
			);
			expect(event.payload).toMatchObject({
				regenerationNeeded: false,
				internalRagUseAllowed: false,
			});
		} finally {
			acquisition.mockRestore();
		}
	});
	it("rejects all three PDF conflicts through all ingestion routes without changing stored data", async () => {
		const bytes = uniqueFictionalPdf();
		const filename = `Cẩm nang-${randomUUID()}.pdf`;
		const existing = await create(fictionalMetadata, bytes, filename);
		const version = existing.versions[0];
		expect(version.originalFilename).toBe(filename);
		const metadata = { ...fictionalMetadata, sourceTitle: "Different title, same bytes" };
		const other = await create(metadata);
		const renamed = `renamed-${randomUUID()}.pdf`;
		const sourceUrl = "https://example.org/fictional";
		const acquisition = jest.spyOn(app.get(PdfSourceService), "fromUrl");
		const counts = () =>
			db.query(`SELECT
				(SELECT count(*) FROM survival_documents) AS documents,
				(SELECT count(*) FROM survival_document_versions) AS versions,
				(SELECT count(*) FROM survival_document_uploads) AS uploads,
				(SELECT count(*) FROM audit_logs WHERE target_type='survival_document') AS audits`);
		const beforeCounts = await counts();
		const beforeFiles = (await readdir(root)).sort();
		try {
			const attempts: Array<[string, () => ReturnType<typeof uploadPdf>]> = [
				["SOURCE_DUPLICATE_PDF", () => uploadPdf(bytes, metadata, renamed)],
				["SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT", () => uploadPdf(bytes, metadata, filename)],
				["SOURCE_DUPLICATE_PDF_NAME", () => uploadPdf(uniqueFictionalPdf(), metadata, filename)],
				[
					"SOURCE_DUPLICATE_PDF_NAME",
					() => uploadPdf(uniqueFictionalPdf(), metadata, filename.toUpperCase()),
				],
				[
					"SOURCE_DUPLICATE_PDF_NAME",
					() => uploadPdf(uniqueFictionalPdf(), metadata, ` ${filename.normalize("NFD")}`),
				],
				[
					"SOURCE_DUPLICATE_PDF",
					() => uploadPdf(bytes, metadata, other.versions[0].originalFilename),
				],
				[
					"SOURCE_DUPLICATE_PDF",
					() => {
						acquisition.mockImplementationOnce(async () => ({
							...(await validatePdf(bytes, renamed)),
							bytes,
						}));
						return request(app.getHttpServer())
							.post(`${endpoint}/import-url`)
							.set("Authorization", token("admin"))
							.send({ sourceUrl, metadata });
					},
				],
				[
					"SOURCE_DUPLICATE_PDF_NAME",
					() =>
						request(app.getHttpServer())
							.post(`${endpoint}/${other.id}/versions`)
							.set("Authorization", token("admin"))
							.field("expectedDocumentRevision", String(other.revision))
							.field("metadata", JSON.stringify(metadata))
							.attach("file", uniqueFictionalPdf(), filename),
				],
				[
					"SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT",
					() => {
						acquisition.mockImplementationOnce(async () => ({
							...(await validatePdf(bytes, filename)),
							bytes,
						}));
						return request(app.getHttpServer())
							.post(`${endpoint}/${existing.id}/versions/import-url`)
							.set("Authorization", token("admin"))
							.send({ sourceUrl, metadata, expectedDocumentRevision: existing.revision });
					},
				],
			];
			for (const [code, attempt] of attempts) {
				const duplicate = await attempt().expect(409);
				expect(duplicate.body).toMatchObject({
					code,
					documentId: existing.id,
					versionId: version.id,
					versionNumber: 1,
					sourceTitle: version.metadata.sourceTitle,
				});
			}
		} finally {
			acquisition.mockRestore();
		}
		expect(await counts()).toEqual(beforeCounts);
		expect((await readdir(root)).sort()).toEqual(beforeFiles);
		for (const doc of [existing, other]) {
			const current = await request(app.getHttpServer())
				.get(`${endpoint}/${doc.id}`)
				.set("Authorization", token("admin"))
				.expect(200);
			expect(current.body).toEqual(doc);
		}
	});
	it.each([
		{ matching: "checksum", code: "SOURCE_DUPLICATE_PDF" },
		{ matching: "filename", code: "SOURCE_DUPLICATE_PDF_NAME" },
	])(
		"allows only one document when upload and URL import share a $matching",
		async ({ matching, code }) => {
			const uploadBytes = uniqueFictionalPdf();
			const uploadName = `upload-${randomUUID()}.pdf`;
			const sameName = matching === "filename";
			const bytes = sameName ? uniqueFictionalPdf() : uploadBytes;
			const remoteName = sameName ? uploadName.toUpperCase() : `remote-${randomUUID()}.pdf`;
			const parsed = await validatePdf(bytes, remoteName);
			const acquisition = jest.spyOn(app.get(PdfSourceService), "fromUrl").mockResolvedValue({
				...parsed,
				bytes,
			});
			const repo = app.get(SurvivalDocumentsRepository);
			const assertPdfIsNew = repo.assertPdfIsNew.bind(repo);
			let preflightCount = 0;
			let releasePreflight: () => void = () => undefined;
			const bothPassedPreflight = new Promise<void>((resolve) => {
				releasePreflight = resolve;
			});
			// Force both requests to pass the real preflight query before either enters its transaction.
			const preflight = jest.spyOn(repo, "assertPdfIsNew").mockImplementation(async (...args) => {
				await assertPdfIsNew(...args);
				const [manager] = args;
				if (manager !== db.manager) return;
				preflightCount++;
				if (preflightCount === 2) releasePreflight();
				await bothPassedPreflight;
			});
			const beforeFiles = (await readdir(root)).length;
			const beforeReservations = await db.query(
				"SELECT count(*)::int FROM survival_document_uploads"
			);
			try {
				const results = await Promise.all([
					uploadPdf(uploadBytes, fictionalMetadata, uploadName),
					request(app.getHttpServer())
						.post(`${endpoint}/import-url`)
						.set("Authorization", token("admin"))
						.send({ sourceUrl: fictionalMetadata.sourceUrl, metadata: fictionalMetadata }),
				]);
				expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
				const saved = results.find((result) => result.status === 201)?.body as SourceTestDetail;
				expect(results.find((result) => result.status === 409)?.body).toMatchObject({
					code,
					documentId: saved.id,
					versionId: saved.versions[0].id,
				});
				expect(
					await db.query("SELECT id FROM survival_document_versions WHERE checksum IN ($1,$2)", [
						parsed.checksum,
						(await validatePdf(uploadBytes, uploadName)).checksum,
					])
				).toEqual([{ id: saved.versions[0].id }]);
				expect(await readdir(root)).toHaveLength(beforeFiles + 1);
				expect(await db.query("SELECT count(*)::int FROM survival_document_uploads")).toEqual([
					{ count: beforeReservations[0].count + 1 },
				]);
			} finally {
				preflight.mockRestore();
				acquisition.mockRestore();
			}
		}
	);
	it("persists source/checksum privately and gates publication on rights and the current draft revision", async () => {
		const bytes = uniqueFictionalPdf();
		let doc = await create(fictionalMetadata, bytes);
		const original = doc.versions[0];
		expect(original.status).toBe(DocumentStatus.DRAFT);
		expect(original).not.toHaveProperty("fileRef");
		const download = await request(app.getHttpServer())
			.get(`${endpoint}/${doc.id}/versions/${original.id}/file`)
			.set("Authorization", token("admin"))
			.expect(200);
		expect(download.headers["cache-control"]).toContain("no-store");
		expect(download.body).toEqual(bytes);
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
		await action(stale, "publish", { rights: fictionalRights }, 409);
		await action(
			doc,
			"publish",
			{ rights: { ...fictionalRights, internalRagUseAllowed: false } },
			422
		);
		doc = (await action(doc, "publish", { rights: fictionalRights })).body as SourceTestDetail;
		await request(app.getHttpServer())
			.patch(`${endpoint}/${doc.id}/versions/${original.id}/metadata`)
			.set("Authorization", token("admin"))
			.send({ expectedRevision: doc.versions[0].revision, metadata: fictionalMetadata })
			.expect(409);
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
		expect(doc.history.some((event) => event.action === "survival_document.publish")).toBe(true);
	});
	it("allocates versions and publishes concurrently with one winner; keeps old provenance and durable regeneration event", async () => {
		let doc = await create();
		doc = (await action(doc, "publish", { rights: fictionalRights })).body as SourceTestDetail;
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
				.attach("file", uniqueFictionalPdf(), `fictional-${randomUUID()}-v2.pdf`);
		const results = await Promise.all([replacement(), replacement()]);
		expect(results.map((item) => item.status).sort()).toEqual([201, 409]);
		doc = results.find((item) => item.status === 201)?.body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBe(first.id);
		expect(doc.versions[0].versionNumber).toBe(2);
		expect(doc.versions[1].metadata).toEqual(first.metadata);
		const publish = () =>
			request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/publish`)
				.set("Authorization", token("admin"))
				.send({ expectedRevision: doc.versions[0].revision, rights: fictionalRights })
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
		await action(medical, "publish", { rights: fictionalRights }, 422);
		medical = (
			await action(medical, "publish", {
				rights: {
					...fictionalRights,
					medicalContentReviewStatus: MedicalStatus.APPROVED,
					offlineRedistributionAllowed: true,
				},
			})
		).body as SourceTestDetail;
		expect(
			(await reader.readPublished(medical.versions[0].id, "OFFLINE")).manifest.rights
				.offlineRedistributionAllowed
		).toBe(true);
		const originalDraft = await create();
		const original = (await action(originalDraft, "publish", { rights: fictionalRights }))
			.body as SourceTestDetail;
		let translation = await create({
			...fictionalMetadata,
			locale: "en",
			originalVersionId: original.versions[0].id,
			adaptationDisclaimer: "Fictional translation by a test author",
		});
		await action(translation, "publish", { rights: fictionalRights }, 422);
		translation = (
			await action(translation, "publish", {
				rights: { ...fictionalRights, translationAllowed: true },
			})
		).body as SourceTestDetail;
		expect(
			(await reader.readPublished(translation.versions[0].id, "TRANSLATION")).manifest.metadata
				.originalVersionId
		).toBe(original.versions[0].id);
	});
	it("rolls back publication, pointer and outbox together when audit fails", async () => {
		const draft = await create();
		const repo = app.get(SurvivalDocumentsRepository);
		const audit = jest.spyOn(repo, "audit").mockRejectedValueOnce(new Error("audit unavailable"));
		await action(draft, "publish", { rights: fictionalRights }, 500);
		audit.mockRestore();
		const state = (
			await request(app.getHttpServer())
				.get(`${endpoint}/${draft.id}`)
				.set("Authorization", token("admin"))
		).body as SourceTestDetail;
		expect(state.currentPublishedVersionId).toBeNull();
		expect(state.versions[0].status).toBe(DocumentStatus.DRAFT);
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
			.attach("file", uniqueFictionalPdf(), "fictional.pdf")
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
			.attach("file", uniqueFictionalPdf(), "fictional.pdf")
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
	it("reopens legacy review states and preserves publication, rights and audit continuity", async () => {
		const runner = db.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		try {
			const schema = `legacy_${randomUUID().replaceAll("-", "")}`;
			await runner.query(`CREATE SCHEMA ${schema}`);
			await runner.query(`SET LOCAL search_path TO ${schema}, public`);
			await runner.query("CREATE TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL)");
			await new ManageSurvivalDocuments1793500000000().up(runner);
			const documentId = randomUUID();
			const pdf = await validatePdf(fictionalPdf, "fictional.pdf");
			await runner.query(
				"INSERT INTO survival_documents(id,created_by,version_count) VALUES($1,$2,4)",
				[documentId, ids.admin]
			);
			const statuses = ["IN_REVIEW", "APPROVED", "REJECTED", "PUBLISHED"];
			const versionIds = statuses.map(() => randomUUID());
			for (const [index, status] of statuses.entries()) {
				const id = versionIds[index];
				const fileRef = randomUUID();
				await runner.query("INSERT INTO survival_document_uploads(file_ref) VALUES($1)", [fileRef]);
				await runner.query(
					`INSERT INTO survival_document_versions
					 (id,document_id,version_number,status,metadata,rights,file_ref,original_filename,checksum,size,
					  content_type,created_by,reviewed_by,reviewed_at,published_by,published_at,reason)
					 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'application/pdf',$11,$11,now(),$12,$13,$14)`,
					[
						id,
						documentId,
						index + 1,
						status,
						fictionalMetadata,
						fictionalRights,
						fileRef,
						pdf.originalFilename,
						pdf.checksum,
						pdf.size,
						ids.admin,
						status === "PUBLISHED" ? ids.admin : null,
						status === "PUBLISHED" ? new Date() : null,
						status === "REJECTED" ? "Fictional source was rejected" : null,
					]
				);
			}
			await runner.query(
				"UPDATE survival_documents SET current_published_version_id=$2 WHERE id=$1",
				[documentId, versionIds[3]]
			);
			await runner.query("SET CONSTRAINTS ALL IMMEDIATE");
			await new RefactorSurvivalDocumentLifecycle1793600000000().up(runner);
			await new IndexSurvivalDocumentChecksum1793700000000().up(runner);
			await new IndexSurvivalDocumentFilename1793800000000().up(runner);
			const rows: Array<{
				status: string;
				rights: SourceTestDetail["versions"][number]["rights"];
				revision: number;
				reason: string | null;
			}> = await runner.query(
				"SELECT status, rights, revision, reason FROM survival_document_versions WHERE checksum=$1 ORDER BY version_number",
				[pdf.checksum]
			);
			expect(rows.map((row) => [row.status, row.revision])).toEqual([
				[DocumentStatus.DRAFT, 2],
				[DocumentStatus.DRAFT, 2],
				[DocumentStatus.DRAFT, 2],
				[DocumentStatus.PUBLISHED, 1],
			]);
			expect(rows[0].rights.rightsReviewStatus).toBe(RightsStatus.NOT_REVIEWED);
			expect(rows[1].rights).toEqual(fictionalRights);
			expect(rows[2]).toMatchObject({
				rights: { rightsReviewStatus: RightsStatus.RESTRICTED, internalRagUseAllowed: false },
				reason: "Fictional source was rejected",
			});
			expect(rows[3].rights).toEqual(fictionalRights);
			expect(
				await runner.query("SELECT revision,current_published_version_id FROM survival_documents")
			).toEqual([{ revision: 2, current_published_version_id: versionIds[3] }]);
			expect(
				await runner.query(
					`SELECT "before"->>'status' AS status FROM audit_logs
					 WHERE action='survival_document.reopen_legacy_draft' ORDER BY status`
				)
			).toEqual([{ status: "APPROVED" }, { status: "IN_REVIEW" }, { status: "REJECTED" }]);
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
		}
	});
});
