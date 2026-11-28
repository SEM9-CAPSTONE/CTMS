import { ConflictException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { fictionalMetadata, fictionalRights } from "../../../test/support/survival-source-fixture";
import type { KnowledgeChunksRepository } from "../knowledge-chunks/knowledge-chunks.repository";
import {
	EditAction,
	applyEditorOperations,
	assertPreparationAdaptation,
	sourceSections,
} from "./document-editor.policy";
import type { PdfSourceService } from "./pdf-source.service";
import type { SourceFilesService } from "./source-files.service";
import type { SourceUploadCleanupService } from "./source-upload-cleanup.service";
import type { SurvivalDocumentsRepository } from "./survival-documents.repository";
import { SurvivalDocumentsService } from "./survival-documents.service";
import { Classification, DocumentStatus, type SourceVersion } from "./survival-documents.types";

const version = (id: string, status = DocumentStatus.DRAFT): SourceVersion => ({
	id,
	documentId: "document",
	versionNumber: id === "old" ? 1 : 2,
	revision: 1,
	status,
	metadata: { ...fictionalMetadata },
	rights: { ...fictionalRights },
	checksum: "a".repeat(64),
	fileRef: "private",
	originalFilename: "huong-dan.pdf",
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
});
function fixture() {
	const query = jest.fn().mockResolvedValue([]);
	const manager = { query } as unknown as EntityManager;
	const repo = {
		db: {
			transaction: jest.fn((work: (manager: EntityManager) => Promise<void>) => work(manager)),
		},
		document: jest
			.fn()
			.mockResolvedValue({ id: "document", revision: 3, currentPublishedVersionId: "old" }),
		version: jest.fn(async (_manager, _doc, id) =>
			version(id, id === "old" ? DocumentStatus.PUBLISHED : DocumentStatus.DRAFT)
		),
		audit: jest.fn().mockResolvedValue(undefined),
	};
	const knowledge = {
		preparedForPublication: jest.fn().mockResolvedValue({ id: "prepared" }),
		activatePrepared: jest.fn().mockResolvedValue(undefined),
	};
	const files = { read: jest.fn().mockResolvedValue(Buffer.from("pdf")) };
	const service = new SurvivalDocumentsService(
		repo as unknown as SurvivalDocumentsRepository,
		files as unknown as SourceFilesService,
		{} as PdfSourceService,
		{} as SourceUploadCleanupService,
		knowledge as unknown as KnowledgeChunksRepository
	);
	jest.spyOn(service, "detail").mockResolvedValue({} as never);
	return { service, knowledge, repo, query, manager };
}
describe("Document publication transaction", () => {
	it("T21: restored composed medical content requires current adaptation and exact-PDF specialist grants", async () => {
		const restored = version("restored");
		restored.restoredFromVersionId = "historical-copy";
		restored.metadata.classification = Classification.FIRST_AID;
		const original = "b".repeat(64);
		const manager = {
			query: jest.fn().mockResolvedValue([
				{
					baseVersionId: "base",
					snapshot: {
						baseChecksum: original,
						sections: [],
						reviewBasis: "Đã đối chiếu các hướng dẫn và điều kiện sử dụng.",
					},
				},
			]),
		} as unknown as EntityManager;
		const keys = [
			"SURVIVAL_EDITOR_APPROVED_SHA256",
			"SURVIVAL_EDITOR_MEDICAL_APPROVED_SHA256",
		] as const;
		const before = keys.map((key) => process.env[key]);
		try {
			process.env[keys[0]] = original;
			process.env[keys[1]] = "";
			await expect(assertPreparationAdaptation(manager, restored)).rejects.toMatchObject({
				status: 422,
			});
			process.env[keys[1]] = restored.checksum;
			await expect(assertPreparationAdaptation(manager, restored)).resolves.toBeUndefined();
			process.env[keys[0]] = "";
			await expect(assertPreparationAdaptation(manager, restored)).rejects.toMatchObject({
				status: 422,
			});
		} finally {
			keys.forEach((key, i) => {
				if (before[i] === undefined) Reflect.deleteProperty(process.env, key);
				else process.env[key] = before[i];
			});
		}
	});
	it("checks expected document and draft revisions before any publication side effect", async () => {
		const f = fixture();
		await expect(
			f.service.change("admin", "document", "draft", {
				action: "publish",
				dto: { expectedRevision: 1, expectedDocumentRevision: 2 },
			})
		).rejects.toMatchObject({ status: 409 });
		expect(f.query).not.toHaveBeenCalled();
		expect(f.knowledge.activatePrepared).not.toHaveBeenCalled();
	});
	it("T07: rejects non-READY replacement knowledge before superseding the existing publication", async () => {
		const f = fixture();
		f.knowledge.preparedForPublication.mockRejectedValue(new ConflictException());
		await expect(
			f.service.change("admin", "document", "draft", {
				action: "publish",
				dto: { expectedRevision: 1, expectedDocumentRevision: 3 },
			})
		).rejects.toMatchObject({ status: 409 });
		expect(f.query.mock.calls.some(([sql]) => /UPDATE|INSERT/.test(sql))).toBe(false);
		expect(f.knowledge.activatePrepared).not.toHaveBeenCalled();
	});
	it("T05: uses the same locked transaction for preparation validation, lifecycle writes, outbox and activation", async () => {
		const f = fixture();
		await f.service.change("admin", "document", "draft", {
			action: "publish",
			dto: { expectedRevision: 1, expectedDocumentRevision: 3 },
		});
		expect(f.repo.document).toHaveBeenCalledWith(f.manager, "document", true);
		expect(f.knowledge.preparedForPublication).toHaveBeenCalledWith(
			f.manager,
			expect.objectContaining({ id: "draft" })
		);
		expect(f.knowledge.activatePrepared).toHaveBeenCalledWith(f.manager, "document", {
			id: "prepared",
		});
		expect(f.query.mock.calls.some(([sql]) => sql.includes("status='SUPERSEDED'"))).toBe(true);
		expect(
			f.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO survival_document_outbox"))
		).toBe(true);
	});
	it("T01/T03: preparing a draft does not call activation or change the published version", async () => {
		const f = fixture();
		await f.service.change("admin", "document", "draft", {
			action: "prepare",
			dto: { expectedRevision: 1, expectedDocumentRevision: 3, confirmSource: true },
		});
		expect(f.knowledge.activatePrepared).not.toHaveBeenCalled();
		expect(f.knowledge.preparedForPublication).not.toHaveBeenCalled();
		expect(
			f.query.mock.calls.some(
				([sql]) =>
					sql.includes("status='SUPERSEDED'") || sql.includes("SET current_published_version_id")
			)
		).toBe(false);
		expect(
			f.query.mock.calls.find(([sql]) =>
				sql.includes("INSERT INTO survival_document_outbox")
			)?.[1]?.[3]
		).toBe("draft_preparation_requested");
	});
	it("T11: restores C from V1 into ABEF as ABCF, retaining F and the historical source", () => {
		const sections = (labels: string, id: string) =>
			sourceSections(
				[...labels].map((heading, i) => ({
					heading,
					items: [{ kind: "paragraph" as const, text: `Nội dung mục ${heading}`, rows: [] }],
					pages: [1],
					item_refs: [`#/texts/${i}`],
				})),
				version(id)
			);
		const historical = sections("ABCD", "v1");
		const current = sections("ABEF", "v3");
		const original = structuredClone(current);
		const restored = applyEditorOperations(
			current,
			[
				{
					action: EditAction.REPLACE,
					targetId: current[2].id,
					fromVersionId: "v1",
					fromSectionId: historical[2].id,
				},
			],
			new Map([["v1", historical]])
		);
		expect(restored.map((section) => section.heading).join("")).toBe("ABCF");
		expect(restored[2].source?.versionId).toBe("v1");
		expect(restored[3]).toEqual(original[3]);
		expect(current).toEqual(original);
	});
});
