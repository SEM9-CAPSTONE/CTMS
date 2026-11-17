export type ReviewStatus = "pending" | "reviewing" | "actioned";
export type ProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | "SUPERSEDED";
export type Disposition = "VERIFIED_FIX" | "JUSTIFIED_NO_FIX";
export type TechnicalStatus = "OPEN" | "HANDED_OFF" | Disposition;
export type IssueClassification =
	| "FACTUAL"
	| "UNSUPPORTED_CLAIM"
	| "SOURCE_MISMATCH"
	| "OUTDATED_CONTEXT"
	| "INCOMPLETE_ANSWER"
	| "SAFETY"
	| "UNDETERMINED";

export type InvestigationScope = "ALL" | "UNSAFE" | "NOT_USEFUL";

export type InvestigationFilters = {
	scope: InvestigationScope;
	reviewStatus?: ReviewStatus;
	groupId?: string;
	q?: string;
	page: number;
};

export type InvestigationSummary = {
	id: string;
	mode: "LOCAL" | "ONLINE";
	createdAt: string;
	reportedAt: string | null;
	reviewStatus: ReviewStatus | null;
	technicalStatus: TechnicalStatus;
	closedAt: string | null;
	processingStatus: ProcessingStatus;
	rating: "USEFUL" | "NOT_USEFUL" | null;
};

export type IssueGroup = {
	id: string;
	issueIndex: number;
	classification: IssueClassification;
	caseCount: number;
};

export type InvestigationList = {
	items: Array<InvestigationSummary & { questionPreview?: string | null }>;
	pagination: { page: number; limit: number; total: number; totalPages: number };
	group: { classification: IssueClassification } | null;
	summary?: {
		totalCases: number;
		unsafeCases: number;
		notUsefulCases: number;
		resolvedCases: number;
	};
};

export type InvestigationIssue = {
	classification: IssueClassification;
	observation: string;
	suspectedCause: string | null;
	supportingEvidence: number[];
	conflictingEvidence: number[];
	confidence: "LOW" | "MEDIUM" | "HIGH";
	uncertainty: string;
	missingInformation: string[];
	proposedRemediation: string | null;
	regressionCases: Array<{ scenario: string; expected: string }>;
};

export type Evidence = {
	question: string | null;
	answer: string | null;
	provenance: "CLIENT_REPORTED" | "SERVER_RECORDED";
	trace: {
		observedAt?: string;
		inferenceStartedAt?: string;
		safetyPolicyVersion?: string;
		runtimeConfigVersion?: string;
	} | null;
	modelId?: string | null;
	modelVersion?: string | null;
	packageVersion?: number | null;
	promptVersion?: string | null;
	retrievalConfigVersion?: string | null;
};

export type InvestigationSource = {
	evidenceId: number;
	cited: boolean;
	status: "AVAILABLE" | "UNAVAILABLE";
	reference?: { title: string; version: number; locations: Array<{ page: number }> };
};

export type InvestigationCommand =
	| { action: "START_REVIEW"; version: number }
	| { action: "HANDOFF"; version: number; reference: string; verification: string }
	| {
			action: "RESOLVE";
			version: number;
			disposition: Disposition;
			reference: string | null;
			verification: string;
			resolutionNote: string;
	  };

export type InvestigationDetail = InvestigationSummary & {
	version: number;
	reason: string | null;
	evidenceRemovedAt: string | null;
	reviewerName: string | null;
	reviewedAt: string | null;
	resolutionNote: string | null;
	evidence: Evidence | null;
	sources: InvestigationSource[];
	report: { issues: InvestigationIssue[]; provider: string | null; model: string | null } | null;
	reportRestricted: boolean;
	observations: { unmatchedCitation: boolean };
	groups: IssueGroup[];
	history: Array<{
		version: number;
		reference: string | null;
		verification: string | null;
		resolutionNote: string | null;
		actorName: string | null;
		action: string;
		at: string;
		technicalStatus: TechnicalStatus;
		reviewStatus: ReviewStatus | null;
	}>;
};
