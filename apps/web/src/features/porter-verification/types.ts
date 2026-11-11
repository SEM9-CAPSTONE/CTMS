export type PorterVerificationStatus =
	| "pending_documents"
	| "pending_review"
	| "approved"
	| "rejected";

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
	documents: PorterVerificationDocument[];
}
