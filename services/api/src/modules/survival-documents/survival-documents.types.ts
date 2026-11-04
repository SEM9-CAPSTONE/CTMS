export enum DocumentStatus {
	DRAFT = "DRAFT",
	IN_REVIEW = "IN_REVIEW",
	APPROVED = "APPROVED",
	PUBLISHED = "PUBLISHED",
	REJECTED = "REJECTED",
	SUPERSEDED = "SUPERSEDED",
	ARCHIVED = "ARCHIVED",
}
export enum RightsStatus {
	NOT_REVIEWED = "NOT_REVIEWED",
	REVIEW_REQUIRED = "REVIEW_REQUIRED",
	PERMITTED = "PERMITTED",
	RESTRICTED = "RESTRICTED",
}
export enum MedicalStatus {
	NOT_REVIEWED = "NOT_REVIEWED",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
}
export enum Classification {
	NATURAL_HAZARDS = "NATURAL_HAZARDS",
	TREKKING_SAFETY = "TREKKING_SAFETY",
	WEATHER_SAFETY = "WEATHER_SAFETY",
	WATER_SAFETY = "WATER_SAFETY",
	MEDICAL_REFERENCE = "MEDICAL_REFERENCE",
	FIRST_AID = "FIRST_AID",
}
export interface SourceMetadata {
	sourceTitle: string;
	publisher: string;
	sourceUrl?: string;
	classification: Classification;
	locale: string;
	originalLocale: string;
	sourcePublishedAt?: string;
	retrievedAt: string;
	licenseType: string;
	licenseUrl?: string;
	permissionEvidence: string;
	changeSummary: string;
	attribution: string;
	originalVersionId?: string;
	adaptationDisclaimer?: string;
}
export interface SourceRights {
	rightsReviewStatus: RightsStatus;
	sourceReviewConfirmed: boolean;
	internalRagUseAllowed: boolean;
	offlineRedistributionAllowed: boolean;
	translationAllowed: boolean;
	medicalContentReviewStatus: MedicalStatus;
	evidence: string;
}
export const UNREVIEWED_RIGHTS: SourceRights = {
	rightsReviewStatus: RightsStatus.NOT_REVIEWED,
	sourceReviewConfirmed: false,
	internalRagUseAllowed: false,
	offlineRedistributionAllowed: false,
	translationAllowed: false,
	medicalContentReviewStatus: MedicalStatus.NOT_REVIEWED,
	evidence: "",
};
export interface StoredSourceFile {
	fileRef: string;
	originalFilename: string;
	checksum: string;
	size: number;
	contentType: string;
}
export interface SourceVersion extends StoredSourceFile {
	id: string;
	documentId: string;
	versionNumber: number;
	revision: number;
	status: DocumentStatus;
	metadata: SourceMetadata;
	rights: SourceRights;
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
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}
export interface DocumentListItem extends SurvivalDocument {
	publishedVersionNumber: number | null;
	latestVersion: Omit<SourceVersion, "fileRef">;
	processingSyncStatus: "REGENERATION_NEEDED" | "NOT_PROCESSED";
}
export type SourceUse = "AI" | "OFFLINE" | "TRANSLATION";
export type PublicSourceVersion = Omit<SourceVersion, "fileRef">;
export const VERSION_SELECT = `SELECT id, document_id AS "documentId",version_number AS "versionNumber",revision,status,metadata,rights,
	file_ref AS "fileRef",original_filename AS "originalFilename",checksum,size,content_type AS "contentType",original_version_id AS "originalVersionId",
	created_by AS "createdBy",created_at AS "createdAt",reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",
	published_by AS "publishedBy",published_at AS "publishedAt",reason FROM survival_document_versions`;
export const DOCUMENT_SELECT = `SELECT id,revision,version_count AS "versionCount",current_published_version_id AS "currentPublishedVersionId",
	created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM survival_documents`;
export function publicVersion(version: SourceVersion): PublicSourceVersion {
	const { fileRef: _privateReference, ...result } = version;
	return result;
}
