import { createHash } from "node:crypto";
import type { DataSource, EntityManager } from "typeorm";
import { fictionalMetadata, fictionalRights } from "../../../test/support/survival-source-fixture";
import { chunkConfiguration } from "../knowledge-chunks/knowledge-chunks.types";
import { DocumentStatus } from "../survival-documents/survival-documents.types";
import type { RagConfig } from "./rag.config";
import { RagRepository, isEligibleRagPublication } from "./rag.repository";

function active(status = DocumentStatus.PUBLISHED, revision = 0) {
	const configuration = { ...chunkConfiguration(), verification_revision: revision };
	return {
		id: "v1",
		currentVersionId: "v1",
		documentId: "document",
		status,
		configuration,
		publishedBy: "admin",
		publishedAt: new Date().toISOString(),
		checksum: "a".repeat(64),
		fileRef: "private.pdf",
		contentType: "application/pdf",
		metadata: fictionalMetadata,
		rights: fictionalRights,
		configHash: createHash("sha256").update(JSON.stringify(configuration)).digest("hex"),
	} as Parameters<typeof isEligibleRagPublication>[0];
}
describe("RAG publication eligibility", () => {
	it("rejects a superseded V1 even when its chunk publication pointer is retained", () => {
		expect(isEligibleRagPublication(active(DocumentStatus.SUPERSEDED))).toBe(false);
	});
	it("requires the active chunk source to match the current document version", () => {
		const row = active();
		row.currentVersionId = "v2";
		expect(isEligibleRagPublication(row)).toBe(false);
	});
	it("permits a complete verified derived revision with its own immutable identity", () => {
		expect(isEligibleRagPublication(active(DocumentStatus.PUBLISHED, 2))).toBe(true);
	});
	it.each([DocumentStatus.ARCHIVED, DocumentStatus.DRAFT])("denies %s", (status) => {
		expect(isEligibleRagPublication(active(status))).toBe(false);
	});
	it("does not accept changed model profiles, unrecognized pipelines or altered hashes", () => {
		for (const change of [
			{ embedding_dimensions: 768 },
			{ pipeline_version: "unverified" },
			{ max_tokens: 999 },
		]) {
			const row = active();
			Object.assign(row.configuration, change);
			expect(isEligibleRagPublication(row)).toBe(false);
		}
		const row = active();
		row.configHash = "b".repeat(64);
		expect(isEligibleRagPublication(row)).toBe(false);
	});
	it("preserves existing v4 active corpus with exactly the same embedding profile", () => {
		const row = active();
		Reflect.deleteProperty(row.configuration, "verification_revision");
		row.configuration.pipeline_version = "ctms-hybrid-ocr-v4";
		row.configHash = createHash("sha256").update(JSON.stringify(row.configuration)).digest("hex");
		expect(isEligibleRagPublication(row)).toBe(true);
	});
});

describe("Exact document content availability", () => {
	it.each([
		{
			status: DocumentStatus.PUBLISHED,
			currentVersionId: "v1",
			requestedVersionId: "v1",
			complete: true,
			expected: true,
		},
		{
			status: DocumentStatus.PUBLISHED,
			currentVersionId: "v1",
			requestedVersionId: "v2",
			complete: true,
			expected: false,
		},
		{
			status: DocumentStatus.SUPERSEDED,
			currentVersionId: "v2",
			requestedVersionId: "v1",
			complete: true,
			expected: false,
		},
		{
			status: DocumentStatus.ARCHIVED,
			currentVersionId: "v1",
			requestedVersionId: "v1",
			complete: true,
			expected: false,
		},
		{
			status: DocumentStatus.PUBLISHED,
			currentVersionId: "v1",
			requestedVersionId: "v1",
			complete: false,
			expected: false,
		},
	])(
		"only reports a complete current eligible source: %j",
		async ({ status, currentVersionId, requestedVersionId, complete, expected }) => {
			const publication = {
				...active(status),
				currentVersionId,
				chunkSetId: "active-set",
				chunkCount: 100,
				pageCount: 12,
			};
			const query = jest
				.fn()
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([publication])
				.mockResolvedValueOnce([{ complete }]);
			const db = {
				transaction: (_level: string, work: (manager: EntityManager) => unknown) =>
					work({ query } as unknown as EntityManager),
			} as unknown as DataSource;
			const config = { sourceLocales: () => ["vi", "en"] } as unknown as RagConfig;
			expect(
				await new RagRepository(db, config).hasEligibleDocument("document", requestedVersionId)
			).toBe(expected);
		}
	);
});
