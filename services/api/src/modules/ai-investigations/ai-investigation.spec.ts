import { randomUUID } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	UnauthorizedException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { providerInferenceTraceFixture } from "../../../test/support/inference-trace-fixture";
import { RagConfig } from "../rag/rag.config";
import { RagRepository } from "../rag/rag.repository";
import type { RagEvidenceRef } from "../rag/rag.types";
import { Classification } from "../survival-documents/survival-documents.types";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import {
	ensureInvestigationAdmin,
	nextReviewState,
	parseAdminAction,
} from "./ai-investigation-admin.policy";
import {
	AiInvestigationAnalyzer,
	groupKey,
	parseInvestigationReport,
} from "./ai-investigation-analyzer";
import {
	AiInvestigationEvidence,
	recordedEvidence,
	snapshotContent,
	unmatchedCitation,
} from "./ai-investigation-evidence";
import { effectiveChange, investigationPriority } from "./ai-investigation-intake";
import {
	CasePriority,
	type Job,
	Processing,
	Review,
	type Signal,
	type Snapshot,
	Technical,
} from "./ai-investigation.types";

const signal: Signal = {
	id: randomUUID(),
	rating: "USEFUL",
	reported_unsafe: false,
	reason: null,
	reported_at: null,
};
const issue = {
	classification: "UNSUPPORTED_CLAIM",
	observation: "Có một nhận định cần kiểm tra.",
	suspectedCause: "Trích dẫn chưa bao quát nhận định.",
	supportingEvidence: [1],
	conflictingEvidence: [],
	confidence: "MEDIUM",
	uncertainty: "Cần tái hiện với phiên bản nguồn đã ghi.",
	missingInformation: [],
	proposedRemediation: null,
	regressionCases: [],
};
const output = (fields: Record<string, unknown> = {}) => ({
	provider: "gemini",
	model: "gemini-example",
	issues: [{ ...issue, ...fields }],
});

const source: RagEvidenceRef = {
	chunkId: randomUUID(),
	chunkIndex: 0,
	fingerprint: "a".repeat(64),
	source: {
		documentId: randomUUID(),
		documentVersionId: randomUUID(),
		chunkSetId: randomUUID(),
		sourceVersion: 1,
		checksum: "b".repeat(64),
		locale: "vi",
		sourceTitle: "Hướng dẫn đọc bản đồ",
		classification: Classification.TREKKING_SAFETY,
		embeddingModel: "model",
		embeddingRevision: "revision",
		embeddingDimensions: 32,
		pipelineVersion: "v1",
		configHash: "config",
	},
	locations: [{ page: 1, itemRef: "p1" }],
};

describe("CTMS-073 investigation policies", () => {
	it("sends authorized source metadata and uses excerpts only when configured", async () => {
		const restricted: RagEvidenceRef = {
			...source,
			chunkId: randomUUID(),
			source: {
				...source.source,
				sourceTitle: "Tài liệu bị giới hạn truy cập",
			},
		};
		const rag = new RagRepository(
			new DataSource({ type: "postgres" }),
			new RagConfig(new ConfigService())
		);
		const english = { ...source, source: { ...source.source, locale: "en" } };
		jest.spyOn(rag, "resolveInvestigationEvidence").mockResolvedValue([
			{
				...english,
				headings: [],
				score: 1,
				content: "Read the map legend before choosing a route.",
			},
		]);
		const settings = {
			AI_INVESTIGATION_PROVIDER_ENABLED: "true",
			AI_SURVIVAL_SERVICE_TOKEN: "private-token",
			AI_INVESTIGATION_SOURCE_EXCERPTS_ENABLED: "false",
		};
		const analyzer = new AiInvestigationAnalyzer(
			new ConfigService(settings),
			new AiInvestigationEvidence(rag)
		);
		const fetch = jest
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response(JSON.stringify(output())));
		const snapshot: Snapshot = {
			mode: "ONLINE",
			online: {
				locale: "vi",
				question: "Đọc bản đồ thế nào?",
				answer: "Xác định điểm xuất phát.",
				retrieved_evidence: [english, restricted],
				cited_chunk_ids: [english.chunkId],
			},
		};
		const job: Job = {
			id: "1",
			rating: "NOT_USEFUL",
			feedback_id: randomUUID(),
			priority: CasePriority.NOT_USEFUL,
			attempts: 1,
			lease_token: randomUUID(),
			status: Processing.PROCESSING,
		};
		try {
			const withoutExcerpt = await analyzer.analyze(job, snapshot, null);
			expect(withoutExcerpt.issues[0].classification).toBe("UNDETERMINED");
			const body = String(fetch.mock.calls[0][1]?.body);
			expect(JSON.parse(body)).toMatchObject({
				trace: { responseLocale: "vi" },
				sources: [{ locale: "en" }, { status: "UNAVAILABLE" }],
			});
			expect(body).not.toContain(restricted.source.sourceTitle);
			expect(body).not.toContain(source.source.documentId);
			expect(body).not.toContain("Read the map legend");
			expect(JSON.parse(body)).toMatchObject({
				sources: [
					{ evidenceId: 1, cited: true, status: "AVAILABLE" },
					{ evidenceId: 2, cited: false, status: "UNAVAILABLE" },
				],
			});
			settings.AI_INVESTIGATION_SOURCE_EXCERPTS_ENABLED = "true";
			const withExcerpt = await analyzer.analyze(job, snapshot, null);
			expect(withExcerpt.issues[0].classification).toBe("UNSUPPORTED_CLAIM");
			expect(String(fetch.mock.calls[1][1]?.body)).toContain("Read the map legend");
		} finally {
			fetch.mockRestore();
		}
	});

	it("detects effective changes and prioritizes an Unsafe signal over a Useful rating", () => {
		expect(effectiveChange(undefined, signal)).toBe(true);
		expect(effectiveChange(signal, { ...signal })).toBe(false);
		expect(effectiveChange(signal, { ...signal, reason: "Thiếu hướng dẫn" })).toBe(true);
		const useful = investigationPriority(signal);
		const notUseful = investigationPriority({ ...signal, rating: "NOT_USEFUL" });
		const unsafe = investigationPriority({ ...signal, reported_unsafe: true });
		expect(unsafe).toBeLessThan(notUseful);
		expect(notUseful).toBeLessThan(useful);
	});

	it("preserves a supported hypothesis, records missing/conflicting evidence as undetermined", () => {
		expect(parseInvestigationReport(output(), [1]).issues[0]).toMatchObject({
			classification: "UNSUPPORTED_CLAIM",
			suspectedCause: issue.suspectedCause,
		});
		for (const report of [
			parseInvestigationReport(output(), [1], []),
			parseInvestigationReport(output({ conflictingEvidence: [2] }), [1, 2]),
			parseInvestigationReport(output({ confidence: "LOW" }), [1]),
		]) {
			expect(report.issues[0]).toMatchObject({
				classification: "UNDETERMINED",
				suspectedCause: null,
				confidence: "LOW",
			});
		}
	});

	it("rejects fabricated evidence, output fields asserting verification and invalid regression cases", () => {
		expect(() => parseInvestigationReport(output({ supportingEvidence: [2] }), [1])).toThrow(
			"Unknown investigation evidence"
		);
		expect(() => parseInvestigationReport(output({ conflictingEvidence: [1] }), [1])).toThrow(
			"Ambiguous investigation evidence"
		);
		expect(() => parseInvestigationReport(output({ verified: true }), [1])).toThrow(
			"Invalid investigation result shape"
		);
		expect(() =>
			parseInvestigationReport(output({ regressionCases: [{ scenario: "Có bản đồ" }] }), [1])
		).toThrow();
	});

	it("keeps retrieved and cited evidence distinct and groups only an exact, reproducible mismatch signature", () => {
		const missing = randomUUID();
		const snapshot: Snapshot = {
			mode: "ONLINE",
			online: {
				locale: "vi",
				answer: "Đọc bản đồ",
				retrieved_evidence: [source],
				cited_chunk_ids: [missing],
				retrieval_config_version: "v1",
				generation: {
					promptVersion: "ctms-069-grounded-v2",
					trace: {
						...providerInferenceTraceFixture,
						schemaVersion: 1,
						safetyPolicyVersion: "v1",
						retrievalSettings: {},
					} as NonNullable<
						NonNullable<Extract<Snapshot, { mode: "ONLINE" }>["online"]["generation"]>["trace"]
					>,
				},
			},
		};
		expect(recordedEvidence(snapshot)).toMatchObject([
			{ cited: false, ref: { chunkId: source.chunkId } },
			{ cited: true, ref: undefined },
		]);
		expect(unmatchedCitation(snapshot)).toEqual(["v1", "ctms-069-grounded-v2", missing]);
		expect(groupKey("one", 0, "SOURCE_MISMATCH", snapshot)).toBe(
			groupKey("two", 0, "SOURCE_MISMATCH", snapshot)
		);
		expect(groupKey("one", 0, "SAFETY", snapshot)).not.toBe(groupKey("two", 0, "SAFETY", snapshot));
		expect(groupKey("one", 0, "SOURCE_MISMATCH", snapshot)).not.toBe(
			groupKey("two", 0, "SOURCE_MISMATCH", {
				...snapshot,
				online: { ...snapshot.online, cited_chunk_ids: [randomUUID()] },
			})
		);
		const legacy = { ...snapshot, online: { ...snapshot.online, generation: undefined } };
		expect(snapshotContent(legacy)).toMatchObject({ question: null, trace: null });
		expect(unmatchedCitation(legacy)).toBeNull();
	});

	it("scopes investigation to an active Admin", () => {
		const admin = { userId: randomUUID(), roles: [UserRole.ADMIN], status: UserStatus.ACTIVE };
		expect(() => ensureInvestigationAdmin(admin)).not.toThrow();
		expect(() => ensureInvestigationAdmin({ ...admin, roles: [UserRole.CAMPER] })).toThrow(
			ForbiddenException
		);
		expect(() => ensureInvestigationAdmin({ ...admin, status: UserStatus.SUSPENDED })).toThrow(
			UnauthorizedException
		);
	});

	it("prevents skipped, stale or spoofed review actions and separates handoff from disposition", () => {
		const pending = {
			version: 1,
			review_status: Review.PENDING,
			technical_status: Technical.OPEN,
			closed_at: null,
		};
		const disposition = {
			action: "RESOLVE",
			version: 1,
			reference: "CTMS-261",
			verification: "Đối chiếu tài liệu và chạy lại tình huống.",
			disposition: "VERIFIED_FIX",
			resolutionNote: "Đã xác minh bản sửa.",
		};
		expect(() =>
			parseAdminAction({ action: "START_REVIEW", version: 1, reviewerId: randomUUID() })
		).toThrow(UnprocessableEntityException);
		expect(() => parseAdminAction({ ...disposition, resolutionNote: " " })).toThrow(
			UnprocessableEntityException
		);
		expect(() =>
			parseAdminAction({ ...disposition, reference: "https://github.com.example.test/a/b/pull/1" })
		).toThrow(UnprocessableEntityException);
		expect(() => nextReviewState(pending, parseAdminAction(disposition))).toThrow(
			ConflictException
		);
		expect(
			nextReviewState(pending, parseAdminAction({ action: "START_REVIEW", version: 1 }))
		).toMatchObject({ review: Review.REVIEWING, recordReviewer: true });
		const reviewing = { ...pending, review_status: Review.REVIEWING, version: 2 };
		expect(() => nextReviewState(reviewing, parseAdminAction(disposition))).toThrow(
			ConflictException
		);
		expect(
			nextReviewState(
				reviewing,
				parseAdminAction({
					action: "HANDOFF",
					version: 2,
					reference: "CTMS-261",
					verification: "Đối chiếu phiên bản nguồn.",
				})
			)
		).toMatchObject({ review: Review.REVIEWING, close: false, technical: Technical.HANDED_OFF });
		expect(
			nextReviewState(reviewing, parseAdminAction({ ...disposition, version: 2 }))
		).toMatchObject({ review: Review.ACTIONED, close: true });
		expect(
			nextReviewState(
				{ ...pending, review_status: null },
				parseAdminAction({ ...disposition, disposition: "JUSTIFIED_NO_FIX" })
			)
		).toMatchObject({ review: null, recordReviewer: false, close: true });
	});
});
