import type {
	SourceMetadata,
	SourceRights,
	SourceVersion,
	SurvivalDocument,
} from "../../src/modules/survival-documents/survival-documents.types";
import {
	Classification,
	RightsStatus,
	UNREVIEWED_RIGHTS,
} from "../../src/modules/survival-documents/survival-documents.types";
export const fictionalPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
export const fictionalMetadata: SourceMetadata = {
	sourceTitle: "CTMS50 fictional source",
	publisher: "Fictional education publisher",
	sourceUrl: "https://example.org/fictional",
	classification: Classification.TREKKING_SAFETY,
	locale: "vi",
	originalLocale: "vi",
	retrievedAt: "2026-01-01",
	licenseType: "Fictional test license",
	licenseUrl: "https://example.org/license",
	permissionEvidence: "Fictional author explicitly permits storage and processing",
	changeSummary: "Fictional first edition",
	attribution: "Fictional test author",
};
export const fictionalRights: SourceRights = {
	...UNREVIEWED_RIGHTS,
	rightsReviewStatus: RightsStatus.PERMITTED,
	sourceReviewConfirmed: true,
	internalRagUseAllowed: true,
	evidence: "Verified fictional owner permission for this exact PDF version",
};
export interface SourceTestDetail extends SurvivalDocument {
	versions: SourceVersion[];
	history: Array<{
		action: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
	}>;
}
