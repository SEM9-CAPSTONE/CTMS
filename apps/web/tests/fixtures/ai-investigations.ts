import type {
	InvestigationDetail,
	InvestigationList,
} from "../../src/features/admin-ai-investigations/ai-investigations.types";

const reportedAt = "2026-11-17T03:00:00.000Z";

export const investigationFixture: InvestigationDetail = {
	id: "96ee2561-2cdf-43f2-88f6-e50fcf55a6ec",
	mode: "ONLINE",
	createdAt: reportedAt,
	reportedAt,
	reviewStatus: "pending",
	technicalStatus: "OPEN",
	closedAt: null,
	processingStatus: "COMPLETE",
	rating: "NOT_USEFUL",
	version: 1,
	reason: "Chỉ dẫn bỏ qua bước dừng lại và đối chiếu bản đồ.",
	evidenceRemovedAt: null,
	reviewerName: null,
	reviewedAt: null,
	resolutionNote: null,
	evidence: {
		question: "Tôi nên đối chiếu đường đi thế nào?",
		answer: "<b>Tiếp tục đi theo lối mòn.</b>",
		provenance: "SERVER_RECORDED",
		trace: { safetyPolicyVersion: "survival-safety-v1" },
		modelId: "survival-assistant",
	},
	sources: [
		{
			evidenceId: 1,
			cited: true,
			status: "AVAILABLE",
			reference: { title: "Hướng dẫn đọc bản đồ", version: 3, locations: [{ page: 7 }] },
		},
		{ evidenceId: 2, cited: false, status: "UNAVAILABLE" },
	],
	report: {
		provider: null,
		model: null,
		issues: [
			{
				classification: "UNDETERMINED",
				observation: "Bản trả lời thiếu bước đối chiếu.",
				suspectedCause: null,
				supportingEvidence: [1],
				conflictingEvidence: [],
				confidence: "LOW",
				uncertainty: "Chưa đủ bằng chứng để kết luận nguyên nhân.",
				missingInformation: [],
				proposedRemediation: null,
				regressionCases: [],
			},
		],
	},
	reportRestricted: false,
	observations: { unmatchedCitation: true },
	groups: [
		{
			id: "e6bf6875-ba24-4f53-9195-1fc8acccdf60",
			issueIndex: 0,
			classification: "SOURCE_MISMATCH",
			caseCount: 2,
		},
	],
	history: [],
};

export const notUsefulInvestigationFixture: InvestigationDetail = {
	...investigationFixture,
	id: "fa381c48-aac4-4f1e-bd45-6408c215da42",
	mode: "LOCAL",
	reviewStatus: null,
	reportedAt: null,
	processingStatus: "FAILED",
	technicalStatus: "HANDED_OFF",
	evidence: {
		question: "Nên chuẩn bị bản đồ trước chuyến đi thế nào?",
		answer: "Hãy tải bản đồ về thiết bị.",
		provenance: "CLIENT_REPORTED",
		trace: null,
	},
	report: null,
	sources: [],
	groups: [],
	observations: { unmatchedCitation: false },
};

export function investigationList(
	fixture: InvestigationDetail = investigationFixture
): InvestigationList {
	const {
		id,
		mode,
		createdAt,
		reportedAt,
		reviewStatus,
		technicalStatus,
		closedAt,
		processingStatus,
		rating,
	} = fixture;
	return {
		items: [
			{
				id,
				mode,
				createdAt,
				reportedAt,
				reviewStatus,
				technicalStatus,
				closedAt,
				processingStatus,
				rating,
				questionPreview: fixture.evidence?.question ?? null,
			},
		],
		pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		group: null,
		summary: {
			totalCases: 1,
			unsafeCases: reportedAt !== null ? 1 : 0,
			notUsefulCases: reportedAt === null && rating === "NOT_USEFUL" ? 1 : 0,
			resolvedCases: closedAt !== null ? 1 : 0,
		},
	};
}
