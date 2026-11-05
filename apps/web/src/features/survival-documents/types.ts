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
	documentId: string;
	versionNumber: number;
	revision: number;
	status: DocumentStatus;
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
export interface SourceFilters {
	page: number;
	limit: number;
	search: string;
	classification?: Classification;
	locale?: string;
	status?: DocumentStatus;
}
export type SourceAction = "publish" | "archive";
export interface SourceDecision {
	expectedRevision: number;
	reason?: string;
	rights?: SourceRights;
}
