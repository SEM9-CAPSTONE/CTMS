import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { DataSource } from "typeorm";
import { fictionalMetadata, fictionalRights } from "../../../test/support/survival-source-fixture";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RagRepository } from "../rag/rag.repository";
import { DocumentStatus } from "../survival-documents/survival-documents.types";
import { UserRole } from "../users/entities/user.entity";
import { ContentVerificationController } from "./content-verification.controller";
import {
	ContentVerificationService,
	assertVerificationDecision,
} from "./content-verification.service";
import type {
	ExtractionSnapshot,
	IntegrityDecision,
	IntegrityRegion,
} from "./knowledge-chunks.types";
import { chunkConfiguration } from "./knowledge-chunks.types";

const region = (extra: Partial<IntegrityRegion> = {}): IntegrityRegion => ({
	id: "a".repeat(64),
	page: 17,
	bbox: { l: 10, t: 20, r: 100, b: 40, coord_origin: "TOPLEFT" },
	item_refs: ["#/texts/0"],
	kind: "caption",
	original_text: "Hình a",
	issues: ["ocr_low_confidence"],
	related_figures: ["#/pictures/0"],
	critical: false,
	excludable: true,
	assessment: "requires_manual_verification",
	attempts: [],
	decision: null,
	...extra,
});
const decision = (extra: Partial<IntegrityDecision> = {}): IntegrityDecision => ({
	action: "confirm",
	text: "Hình a",
	source_checked: true,
	context_checked: true,
	visual_checked: true,
	...extra,
});
const snapshot = (regions: IntegrityRegion[]): ExtractionSnapshot => ({
	format: 1,
	checksum: "c".repeat(64),
	document_version_id: "version",
	revision: 0,
	configuration: chunkConfiguration(),
	document: {},
	prepared: [],
	regions,
});

describe("Content verification decisions", () => {
	it.each([
		[
			"ingestion_timeout",
			true,
			"Thời gian xử lý nội dung đã vượt giới hạn. Hệ thống sẽ tự động thử lại.",
		],
		["ingestion_transport", false, "Quá trình xử lý nội dung bị gián đoạn."],
		[
			"ocr_runtime_unavailable",
			false,
			"Dịch vụ xử lý tài liệu chưa sẵn sàng. Cần kiểm tra cấu hình máy chủ.",
		],
	])("explains %s and its automatic recovery state", async (error, recovering, notice) => {
		const service = new ContentVerificationService(
			{
				query: jest
					.fn()
					.mockResolvedValueOnce([{}])
					.mockResolvedValueOnce([
						{
							id: "candidate",
							status: "FAILED",
							error_code: error,
							automatic_recovery_pending: recovering,
							extraction_snapshot: null,
						},
					]),
			} as unknown as DataSource,
			{ hasEligibleDocument: jest.fn().mockResolvedValue(false) } as unknown as RagRepository
		);
		expect(await service.inspect("document", "version")).toMatchObject({
			notice,
			automaticRecoveryPending: recovering,
			preparing: false,
			available: false,
		});
	});
	it.each([true, false])(
		"distinguishes active source availability (%s) from a new pending extraction",
		async (inUse) => {
			const query = jest
				.fn()
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{ id: "candidate", status: "PENDING", extraction_snapshot: null }]);
			const hasEligibleDocument = jest.fn().mockResolvedValue(inUse);
			const service = new ContentVerificationService(
				{ query } as unknown as DataSource,
				{ hasEligibleDocument } as unknown as RagRepository
			);
			expect(await service.inspect("document", "version")).toMatchObject({
				inUse,
				preparing: true,
				available: false,
				complete: false,
				extractionId: "candidate",
			});
			expect(hasEligibleDocument).toHaveBeenCalledWith("document", "version");
		}
	);
	it("only confirms a recognized empty form after explicit visual review and a recorded reason", () => {
		const r = region({
			kind: "table",
			critical: true,
			empty_form: true,
			original_text: "",
			related_figures: [],
		});
		const d = decision({
			action: "confirm",
			text: "",
			reason: "Đã đối chiếu vùng biểu mẫu; không có dữ liệu hoặc hướng dẫn.",
		});
		expect(() => assertVerificationDecision(r, d, snapshot([r]))).not.toThrow();
		for (const invalid of [
			{ ...d, visual_checked: false },
			{ ...d, reason: "" },
		])
			expect(() => assertVerificationDecision(r, invalid, snapshot([r]))).toThrow();
		expect(() =>
			assertVerificationDecision({ ...r, empty_form: false }, d, snapshot([r]))
		).toThrow();
	});
	it("confirms an inspected short caption without treating confidence as semantic failure", () => {
		const r = region();
		expect(() => assertVerificationDecision(r, decision(), snapshot([r]))).not.toThrow();
	});
	it.each(["source_checked", "context_checked", "visual_checked"])(
		"requires explicit %s",
		(key) => {
			const r = region();
			expect(() =>
				assertVerificationDecision(r, decision({ [key]: false }), snapshot([r]))
			).toThrow();
		}
	);
	it("never permits exclusion of a critical warning, number, image or table", () => {
		for (const kind of ["text", "table", "image", "page"]) {
			const r = region({ kind, critical: true });
			expect(() =>
				assertVerificationDecision(
					r,
					decision({ action: "exclude", reason: "Already checked by an administrator" }),
					snapshot([r])
				)
			).toThrow();
		}
	});
	it("requires a verified linked image and a reason before excluding a harmless label", () => {
		const r = region();
		const d = decision({
			action: "exclude",
			text: "",
			reason: "Nhãn đã được thay bằng mô tả hình đầy đủ.",
		});
		expect(() => assertVerificationDecision(r, d, snapshot([r]))).toThrow();
		const image = region({
			id: "b".repeat(64),
			kind: "image",
			item_refs: ["#/pictures/0"],
			decision: decision({ action: "describe", text: "A verified full diagram description" }),
		});
		expect(() => assertVerificationDecision(r, d, snapshot([r, image]))).not.toThrow();
	});
	it("rejects changed confirmation text and unanchored missing instructions", () => {
		const r = region();
		expect(() =>
			assertVerificationDecision(r, decision({ text: "Different" }), snapshot([r]))
		).toThrow();
		expect(() =>
			assertVerificationDecision(
				{ ...r, item_refs: [] },
				decision({ action: "correct" }),
				snapshot([r])
			)
		).toThrow();
	});
	it("protects inspection and correction with both JWT and Admin role guards", () => {
		const guards = Reflect.getMetadata("__guards__", ContentVerificationController) as unknown[];
		expect(guards).toHaveLength(2);
		const guard = new RolesGuard(new Reflector());
		for (const handler of [
			ContentVerificationController.prototype.inspect,
			ContentVerificationController.prototype.verify,
		]) {
			for (const role of [UserRole.CAMPER, UserRole.HOST]) {
				const context = {
					getHandler: () => handler,
					getClass: () => ContentVerificationController,
					switchToHttp: () => ({ getRequest: () => ({ user: { roles: [role] } }) }),
				} as unknown as ExecutionContext;
				expect(() => guard.canActivate(context)).toThrow();
			}
		}
	});
	it("does not expose internal confidence, codes, candidates, vectors or immutable PDF contents in inspection", async () => {
		const r = region();
		const query = jest
			.fn()
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([
				{ id: "set", status: "NEEDS_REVIEW", extraction_snapshot: snapshot([r]) },
			]);
		const service = new ContentVerificationService(
			{ query } as unknown as DataSource,
			{ hasEligibleDocument: jest.fn().mockResolvedValue(false) } as unknown as RagRepository
		);
		const result = await service.inspect("document", "version");
		expect(result.positions[0]).toMatchObject({
			page: 17,
			originalText: "Hình a",
			resolved: false,
		});
		for (const word of [
			"confidence",
			"ocr_low_confidence",
			"NEEDS_REVIEW",
			"embedding",
			"prepared",
		])
			expect(JSON.stringify(result)).not.toContain(word);
	});
});

describe("Cached review transactions", () => {
	function harness() {
		const original = {
			id: "set",
			document_id: "document",
			document_version_id: "version",
			source_version: 1,
			checksum: "c".repeat(64),
			locale: "vi",
			configuration: chunkConfiguration(),
			status: "READY",
			extraction_snapshot: snapshot([region({ related_figures: [], decision: decision() })]),
			quality_report: {},
		};
		let latest = structuredClone(original);
		const audits: Array<{
			after: { payloadHash: string; requestId: string };
			before: unknown;
			actor: string;
		}> = [];
		const queries: string[] = [];
		const version = {
			id: "version",
			documentId: "document",
			status: DocumentStatus.PUBLISHED,
			publishedBy: "admin",
			publishedAt: new Date().toISOString(),
			checksum: original.checksum,
			fileRef: "immutable.pdf",
			contentType: "application/pdf",
			metadata: fictionalMetadata,
			rights: fictionalRights,
		};
		const query = jest.fn(async (sql: string, args: unknown[] = []) => {
			queries.push(sql);
			if (sql.includes("survival_document_edit_drafts")) return [];
			if (sql.includes("SELECT current_published_version_id"))
				return [{ current_published_version_id: "version" }];
			if (sql.includes("FROM survival_document_versions")) return [version];
			if (sql.includes('SELECT "after" FROM audit_logs'))
				return audits.filter((row) => row.after.requestId === args[2]);
			if (sql.startsWith("SELECT") && sql.includes("FROM knowledge_chunk_sets")) return [latest];
			if (sql.includes("INSERT INTO knowledge_chunk_sets")) {
				latest = {
					...structuredClone(original),
					id: String(args[0]),
					configuration: JSON.parse(String(args[6])),
				};
				return [];
			}
			if (sql.includes("UPDATE knowledge_chunk_sets SET extraction_snapshot")) {
				latest.extraction_snapshot = JSON.parse(String(args[1]));
				latest.status = String(args[3]);
				return [];
			}
			if (sql.includes("INSERT INTO audit_logs")) {
				audits.push({
					actor: String(args[0]),
					before: JSON.parse(String(args[2])),
					after: JSON.parse(String(args[3])),
				});
				return [];
			}
			throw new Error(`Unexpected query in transaction contract: ${sql}`);
		});
		const db = {
			query,
			transaction: (work: (manager: { query: typeof query }) => Promise<void>) => work({ query }),
		} as unknown as DataSource;
		return {
			service: new ContentVerificationService(db, {
				hasEligibleDocument: jest.fn().mockResolvedValue(true),
			} as unknown as RagRepository),
			original,
			audits,
			queries,
			latest: () => latest,
		};
	}
	it("forks a READY extraction, preserves the active generation and audits/replays exactly once", async () => {
		const h = harness();
		const payload = {
			extractionId: "set",
			requestId: "request",
			expectedRevision: 0,
			action: "correct" as const,
			text: "Nội dung đã đối chiếu",
			source_checked: true,
			context_checked: true,
			visual_checked: false,
		};
		const result = await h.service.verify("admin", "document", "version", "a".repeat(64), payload);
		expect(result.revision).toBe(1);
		expect(h.latest().id).not.toBe("set");
		expect(h.latest().configuration.verification_revision).toBe(1);
		expect(h.latest().status).toBe("PENDING");
		expect(h.original.status).toBe("READY");
		expect(h.original.extraction_snapshot.regions[0].original_text).toBe("Hình a");
		expect(h.queries.some((sql) => sql.includes("knowledge_chunk_publications"))).toBe(false);
		expect(h.audits).toHaveLength(1);
		expect(h.audits[0]).toMatchObject({
			actor: "admin",
			before: { page: 17, originalText: "Hình a", versionId: "version" },
			after: { verifiedText: "Nội dung đã đối chiếu" },
		});
		await h.service.verify("admin", "document", "version", "a".repeat(64), payload);
		expect(h.audits).toHaveLength(1);
		await expect(
			h.service.verify("admin", "document", "version", "a".repeat(64), {
				...payload,
				text: "Different request content",
			})
		).rejects.toMatchObject({ status: 409 });
	});
});
