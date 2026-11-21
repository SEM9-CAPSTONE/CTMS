export type PorterVerificationStatus =
	| "pending_documents"
	| "pending_review"
	| "approved"
	| "rejected";

/** Accepted tour-guide card types; site-only ("tại điểm") cards are not accepted. */
export type GuideCardType = "noi_dia" | "quoc_te";

export interface GuideCard {
	cardType: GuideCardType;
	/** 9 digits as printed on the card. */
	cardNumber: string;
	/** `YYYY-MM-DD`, valid through this date. */
	expiresOn: string;
}

export interface PorterVerificationDocument {
	id: string;
	fileUrl: string;
	originalName: string;
	mimeType: string;
	sizeBytes: number;
	uploadedAt: string;
}

export interface PorterVerification {
	porterId: string;
	status: PorterVerificationStatus;
	submittedAt: string | null;
	reviewedAt: string | null;
	rejectionReason: string | null;
	version: number;
	guideCard: GuideCard | null;
	documents: PorterVerificationDocument[];
}
