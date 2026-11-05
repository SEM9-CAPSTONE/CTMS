import { randomUUID } from "node:crypto";
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
function createFictionalPdf(marker: string): Buffer {
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
	];
	let content = `%PDF-1.4\n% ${marker}\n`;
	const offsets = objects.map((object, index) => {
		const offset = Buffer.byteLength(content);
		content += `${index + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xref = Buffer.byteLength(content);
	content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) content += `${String(offset).padStart(10, "0")} 00000 n \n`;
	return Buffer.from(
		`${content}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	);
}
export const fictionalPdf = createFictionalPdf("fictional source");
export const uniqueFictionalPdf = (): Buffer => createFictionalPdf(randomUUID());
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
	processingSyncStatus: "REGENERATION_NEEDED" | "NOT_PROCESSED";
	versions: SourceVersion[];
	history: Array<{
		action: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
	}>;
}
