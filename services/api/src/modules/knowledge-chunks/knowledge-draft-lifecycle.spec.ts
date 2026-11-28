import { createHash } from "node:crypto";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { DataSource, type EntityManager } from "typeorm";
import { withIntegrity } from "../../../test/support/knowledge-integrity-fixture";
import { fictionalMetadata, fictionalRights } from "../../../test/support/survival-source-fixture";
import {
	isEligiblePreparationSource,
	isEligiblePublishedSource,
} from "../survival-documents/source-policy";
import { SurvivalDocumentsModule } from "../survival-documents/survival-documents.module";
import {
	DocumentStatus,
	MedicalStatus,
	RightsStatus,
	type SourceVersion,
} from "../survival-documents/survival-documents.types";
import { KnowledgeChunksModule } from "./knowledge-chunks.module";
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import { type ChunkSet, ChunkSetStatus, chunkConfiguration } from "./knowledge-chunks.types";

function fixture(status = DocumentStatus.DRAFT) {
	const configuration = chunkConfiguration();
	const version: SourceVersion = {
		id: "draft",
		documentId: "document",
		versionNumber: 2,
		revision: 1,
		knowledgeRevision: 1,
		status,
		metadata: { ...fictionalMetadata },
		rights: { ...fictionalRights },
		fileRef: "private",
		originalFilename: "huong-dan.pdf",
		checksum: "a".repeat(64),
		size: 100,
		contentType: "application/pdf",
		originalVersionId: null,
		createdBy: "admin",
		createdAt: "2026-11-28",
		reviewedBy: "admin",
		reviewedAt: "2026-11-28",
		publishedBy: status === DocumentStatus.PUBLISHED ? "admin" : null,
		publishedAt: status === DocumentStatus.PUBLISHED ? "2026-11-28" : null,
		reason: null,
	};
	const set: ChunkSet & { chunk_count: number } = {
		id: "set",
		document_id: version.documentId,
		document_version_id: version.id,
		source_version: 2,
		checksum: version.checksum,
		locale: version.metadata.locale,
		source_title: version.metadata.sourceTitle,
		input_revision: 1,
		configuration,
		config_hash: createHash("sha256").update(JSON.stringify(configuration)).digest("hex"),
		status: ChunkSetStatus.RUNNING,
		attempts: 1,
		recovery_round: 0,
		lease_token: "lease",
		chunk_count: 1,
	};
	const query = jest.fn(async (sql: string, _args?: unknown[]) => {
		if (sql.includes("survival_document_edit_drafts")) return [];
		if (sql.includes("SELECT current_published_version_id"))
			return [
				{
					current_published_version_id:
						status === DocumentStatus.PUBLISHED ? version.id : "active-v1",
				},
			];
		if (sql.includes("FROM survival_document_versions")) return [version];
		if (sql.startsWith("SELECT * FROM knowledge_chunk_sets")) return [set];
		if (sql.includes("SELECT count(*)")) return [{ complete: true }];
		if (sql.includes("RETURNING id") && sql.includes("INSERT INTO knowledge_chunks"))
			return [{ id: "new-chunk" }];
		return [];
	});
	const manager = { query } as unknown as EntityManager;
	const db = {
		query,
		transaction: (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
	} as unknown as DataSource;
	const repo = new KnowledgeChunksRepository(db);
	const output = withIntegrity({
		document_version_id: version.id,
		source_version: 2,
		checksum: version.checksum,
		locale: version.metadata.locale,
		configuration,
		quality: { status: "PASSED" as const, issues: [], page_count: 1 },
		chunks: [
			{
				chunk_index: 0,
				content: "Kiểm tra điều kiện trước khi xuất phát.",
				embedding_text: "passage: Kiểm tra điều kiện trước khi xuất phát.",
				token_count: 20,
				headings: [],
				locations: [
					{
						page: 1,
						item_ref: "#/texts/0",
						bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" as const },
					},
				],
				embedding: Array.from({ length: 384 }, (_, i) => Number(i === 0)),
			},
		],
	});
	return { repo, manager, query, set, version, output };
}

describe("Draft knowledge lifecycle", () => {
	it("resolves a single shared repository through the document and knowledge modules without a second pipeline", async () => {
		@Global()
		@Module({ providers: [{ provide: DataSource, useValue: {} }], exports: [DataSource] })
		class TestDatabaseModule {}
		const module = await Test.createTestingModule({
			imports: [
				TestDatabaseModule,
				ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
				SurvivalDocumentsModule,
				KnowledgeChunksModule,
			],
		}).compile();
		try {
			expect(module.get(KnowledgeChunksRepository)).toBe(
				module.select(SurvivalDocumentsModule).get(KnowledgeChunksRepository, { strict: true })
			);
		} finally {
			await module.close();
		}
	});
	it("T01/T02/T03: completes an independent draft without publishing or changing the active pointer", async () => {
		const f = fixture();
		expect(isEligiblePreparationSource(f.version, "active-v1")).toBe(true);
		expect(isEligiblePublishedSource(f.version, "active-v1")).toBe(false);
		await expect(f.repo.finish(f.set, f.output)).resolves.toBe(true);
		const writes = f.query.mock.calls.filter(([sql]) => !sql.startsWith("SELECT"));
		expect(
			writes.some(
				([sql, args]) => sql.includes("UPDATE knowledge_chunk_sets") && args?.[1] === "READY"
			)
		).toBe(true);
		expect(
			writes.some(
				([sql]) =>
					sql.includes("knowledge_chunk_publications") || sql.includes("UPDATE survival_document")
			)
		).toBe(false);
	});
	it("T04: a failed draft cannot change active knowledge", async () => {
		const f = fixture();
		await f.repo.finish(f.set, { error: "ingestion_transport", retryable: true });
		expect(f.query.mock.calls.some(([sql]) => sql.includes("knowledge_chunk_publications"))).toBe(
			false
		);
	});
	it("does not mark source knowledge obsolete when the authorization read fails technically", async () => {
		const f = fixture();
		const original = f.query.getMockImplementation();
		f.query.mockImplementation(async (sql, args) => {
			if (sql.includes("survival_document_edit_drafts")) throw new Error("Database unavailable");
			return original ? original(sql, args) : [];
		});
		await expect(f.repo.finish(f.set, f.output)).rejects.toThrow("Database unavailable");
		expect(f.query.mock.calls.some(([sql]) => sql.includes("UPDATE knowledge_chunk_sets"))).toBe(
			false
		);
	});
	it.each(["revision", "title", "locale"])(
		"T09: fences a stale worker after a draft %s changes",
		async (change) => {
			const f = fixture();
			if (change === "revision") f.version.knowledgeRevision = 2;
			if (change === "title") f.version.metadata.sourceTitle = "Hướng dẫn đã cập nhật";
			if (change === "locale") f.version.metadata.locale = "en";
			await f.repo.finish(f.set, f.output);
			expect(
				f.query.mock.calls.find(([sql]) => sql.includes("UPDATE knowledge_chunk_sets"))?.[1]?.[1]
			).toBe("OBSOLETE");
			expect(
				f.query.mock.calls.some(
					([sql]) =>
						sql.includes("INSERT INTO knowledge_chunks") ||
						sql.includes("knowledge_chunk_publications")
				)
			).toBe(false);
		}
	);
	it.each([
		ChunkSetStatus.PENDING,
		ChunkSetStatus.RUNNING,
		ChunkSetStatus.FAILED,
		ChunkSetStatus.NEEDS_REVIEW,
		ChunkSetStatus.OBSOLETE,
	])("T07: rejects publication of %s preparation", async (status) => {
		const f = fixture();
		f.set.status = status;
		await expect(f.repo.preparedForPublication(f.manager, f.version)).rejects.toMatchObject({
			status: 409,
		});
	});
	it.each(["checksum", "locale", "title", "configuration", "quality", "missing chunks"])(
		"T08: rejects READY knowledge with stale or invalid %s",
		async (change) => {
			const f = fixture();
			f.set.status = ChunkSetStatus.READY;
			f.set.quality_report = f.output.quality;
			if (change === "checksum") f.set.checksum = "b".repeat(64);
			if (change === "locale") f.set.locale = "en";
			if (change === "title") f.set.source_title = "Tiêu đề cũ";
			if (change === "configuration") f.set.config_hash = "incorrect";
			if (change === "quality")
				f.set.quality_report = {
					...f.output.quality,
					integrity: { revision: 0, complete: false, regions: [] },
				};
			if (change === "missing chunks")
				f.query.mockImplementation(async (sql) =>
					sql.includes("SELECT count(*)") ? ([{ complete: false }] as never) : ([f.set] as never)
				);
			await expect(f.repo.preparedForPublication(f.manager, f.version)).rejects.toMatchObject({
				status: 409,
			});
		}
	);
	it("T05/T25: accepts complete READY knowledge and activates only through the caller's transaction", async () => {
		const f = fixture();
		f.set.status = ChunkSetStatus.READY;
		f.set.quality_report = f.output.quality;
		// Match JSONB's reordered object keys instead of relying on JS creation order.
		f.set.configuration = Object.fromEntries(
			Object.entries(f.set.configuration).reverse()
		) as typeof f.set.configuration;
		const ready = await f.repo.preparedForPublication(f.manager, f.version);
		expect(
			f.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO knowledge_chunk_publications"))
		).toBe(false);
		await f.repo.activatePrepared(f.manager, f.version.documentId, ready);
		expect(f.query).toHaveBeenLastCalledWith(
			expect.stringContaining("INSERT INTO knowledge_chunk_publications"),
			["document", "set"]
		);
	});
	it.each([DocumentStatus.SUPERSEDED, DocumentStatus.ARCHIVED])(
		"T18/T19: cannot process or retrieve a %s source",
		async (status) => {
			const f = fixture(status);
			expect(isEligiblePreparationSource(f.version, f.version.id)).toBe(false);
			expect(isEligiblePublishedSource(f.version, f.version.id)).toBe(false);
			await f.repo.finish(f.set, f.output);
			expect(
				f.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO knowledge_chunk_publications"))
			).toBe(false);
		}
	);
	it("T21: medical rejection and restricted rights remain blocking for drafts", () => {
		const f = fixture();
		f.version.metadata.classification = "FIRST_AID" as never;
		f.version.rights.medicalContentReviewStatus = MedicalStatus.REJECTED;
		expect(isEligiblePreparationSource(f.version, null)).toBe(false);
		f.version.rights.medicalContentReviewStatus = MedicalStatus.NOT_REVIEWED;
		f.version.rights.rightsReviewStatus = RightsStatus.RESTRICTED;
		expect(isEligiblePreparationSource(f.version, null)).toBe(false);
	});
});
