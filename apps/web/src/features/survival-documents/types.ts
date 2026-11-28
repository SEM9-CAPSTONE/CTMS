export type DocumentStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";
export type Classification =
	| "NATURAL_HAZARDS"
	| "TREKKING_SAFETY"
	| "WEATHER_SAFETY"
	| "WATER_SAFETY"
	| "MEDICAL_REFERENCE"
	| "FIRST_AID";
export interface SourceMetadata {
	sourceTitle: string;
	publisher?: string;
	sourceUrl?: string;
	classification: Classification;
	locale: string;
	originalLocale?: string;
	sourcePublishedAt?: string;
	retrievedAt?: string;
	licenseType?: string;
	licenseUrl?: string;
	permissionEvidence?: string;
	changeSummary?: string;
	attribution?: string;
	originalVersionId?: string;
	adaptationDisclaimer?: string;
}
export interface SourceRights {
	rightsReviewStatus: "NOT_REVIEWED" | "REVIEW_REQUIRED" | "PERMITTED" | "RESTRICTED";
	sourceReviewConfirmed: boolean;
	internalRagUseAllowed: boolean;
	offlineRedistributionAllowed: boolean;
	translationAllowed: boolean;
	medicalContentReviewStatus: "NOT_REVIEWED" | "APPROVED" | "REJECTED";
	evidence: string;
}
export interface SourceVersion {
	id: string;
	composed?: boolean;
	documentId: string;
	versionNumber: number;
	revision: number;
	status: DocumentStatus;
	knowledgeRevision?: number;
	preparationEligible?: boolean;
	requiresKnowledge?: boolean;
	preparationBlockedReason?: string | null;
	restoredFromVersionId?: string | null;
	restorationReason?: string | null;
	restoredFromVersionNumber?: number | null;
	restorationEligible?: boolean;
	metadata: SourceMetadata;
	rights: SourceRights;
	originalFilename: string;
	checksum: string;
	size: number;
	contentType: string;
	originalVersionId: string | null;
	createdBy: string;
	createdAt: string;
	reviewedBy: string | null;
	reviewedAt: string | null;
	publishedBy: string | null;
	publishedAt: string | null;
	reason: string | null;
}
export interface SurvivalDocument {
	id: string;
	revision: number;
	versionCount: number;
	currentPublishedVersionId: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	processingSyncStatus: "REGENERATION_NEEDED" | "NOT_PROCESSED";
}
export interface DocumentListItem extends SurvivalDocument {
	publishedVersionNumber?: number | null;
	latestVersion: SourceVersion;
}
export interface DocumentDetail extends SurvivalDocument {
	processingBlockedReason?: string | null;
	versions: SourceVersion[];
	history: Array<{
		id: string;
		actorId: string;
		action: string;
		before: unknown;
		after: unknown;
		reason: string | null;
		createdAt: string;
	}>;
}
export type PdfSource = { kind: "upload"; file: File } | { kind: "url"; sourceUrl: string };
export type EditAction = "KEEP" | "REPLACE" | "REMOVE" | "RESTORE" | "INSERT" | "REORDER";
export interface EditorSection {
	id: string;
	heading: string;
	pages: number[];
	edited?: boolean;
	source: { versionNumber: number } | null;
	items: Array<{
		kind: "heading" | "paragraph" | "list" | "table";
		text: string;
		rows: string[][];
	}>;
}
export interface EditDraft {
	id: string;
	revision: number;
	confirmedRevision: number | null;
	snapshot: {
		title: string;
		baseSections: EditorSection[];
		sections: EditorSection[];
		reviewBasis?: string;
		changes: Array<{ heading: string; action: EditAction; version?: number; position?: number }>;
	};
}
export interface EditorRevision {
	expectedRevision: number;
	requestId: string;
}
export interface EditPlan extends EditorRevision {
	title?: string;
	instruction?: string;
	operations?: Array<{
		action: EditAction;
		targetId?: string;
		fromVersionId?: string;
		fromSectionId?: string;
		position?: number;
		heading?: string;
		text?: string;
	}>;
}
export interface SourceFilters {
	page: number;
	limit: number;
	search: string;
	classification?: Classification;
	locale?: string;
	status?: DocumentStatus;
}
export type SourceAction = "publish" | "archive" | "prepare" | "restore";
export interface SourceDecision {
	expectedRevision: number;
	expectedDocumentRevision?: number;
	reason?: string;
	confirmSource?: boolean;
	rights?: SourceRights;
}
export type ChunkSetStatus =
	| "PENDING"
	| "RUNNING"
	| "READY"
	| "FAILED"
	| "NEEDS_REVIEW"
	| "OBSOLETE";

export interface SourceChunkSet {
	input_revision?: number;
	completed_at?: string | null;
	status: ChunkSetStatus;
	active: boolean;
	chunk_count: number;
	error_code: string | null;
	automatic_recovery_pending: boolean;
	quality_report: { issues: string[] } | null;
}
