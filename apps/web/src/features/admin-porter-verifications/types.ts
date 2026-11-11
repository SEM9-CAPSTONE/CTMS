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

export interface AdminPorterVerificationDetail extends PorterVerification {
	fullName: string | null;
	email: string | null;
	phone: string | null;
	reviewedBy: string | null;
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
