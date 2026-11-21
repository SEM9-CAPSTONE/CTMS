import type { PorterVerification, PorterVerificationStatus } from "../porter-verification/types";

export interface AdminPorterVerificationSummary {
	porterId: string;
	fullName: string | null;
	email: string | null;
	phone: string | null;
	status: PorterVerificationStatus;
	submittedAt: string | null;
	reviewedAt: string | null;
	documentCount: number;
}

/** The system's automatic check of the card photo (labels never approve on their own). */
export interface GuideCardCheck {
	labels: string[];
	reading: {
		fullName: string | null;
		cardNumber: string | null;
		cardType: string | null;
		expiresOn: string | null;
		confidence: number | null;
		documentId: string | null;
	} | null;
	autoRejected: boolean;
}

export interface AdminPorterVerificationDetail extends PorterVerification {
	fullName: string | null;
	email: string | null;
	phone: string | null;
	reviewedBy: string | null;
	cardCheck: GuideCardCheck | null;
	cardCheckedAt: string | null;
	registryCheckedBy: string | null;
	registryCheckedAt: string | null;
	experienceYears: number | null;
	certifications: string[];
}

export interface PorterVerificationListParams {
	status?: PorterVerificationStatus;
	search?: string;
	page: number;
	limit: number;
}

export interface PaginatedPorterVerifications {
	items: AdminPorterVerificationSummary[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}
