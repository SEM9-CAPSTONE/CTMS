export type PorterCertificateType = "wfa" | "rescue" | "guide_card" | "other";

export type PorterCertificateStatus = "pending" | "verified" | "rejected";

export interface PorterCertificateItem {
	id: string;
	porterId: string;
	type?: PorterCertificateType;
	certificateType: PorterCertificateType;
	name: string;
	certificateNumber: string | null;
	issuedBy: string;
	issuedDate?: string | null;
	issueDate: string | null;
	expiryDate: string;
	fileUrl: string;
	status: PorterCertificateStatus;
	rejectionReason: string | null;
	verifiedBy: string | null;
	verifiedAt: string | null;
	createdAt: string;
	updatedAt: string;
	isExpired: boolean;
	porter?: {
		id: string;
		fullName: string;
		email: string;
		phone?: string;
	};
}

export interface CreatePorterCertificateInput {
	type?: PorterCertificateType;
	certificateType: PorterCertificateType;
	name: string;
	certificateNumber?: string;
	issuedBy: string;
	issuedDate?: string;
	issueDate?: string;
	expiryDate: string;
	fileUrl?: string;
	file?: File;
}

export interface UpdatePorterCertificateInput {
	type?: PorterCertificateType;
	certificateType?: PorterCertificateType;
	name?: string;
	certificateNumber?: string;
	issuedBy?: string;
	issuedDate?: string;
	issueDate?: string;
	expiryDate?: string;
	fileUrl?: string;
	file?: File;
}

export interface AdminRejectCertificateInput {
	rejectionReason: string;
}

export interface AdminGetCertificatesQuery {
	status?: PorterCertificateStatus | "expired";
	search?: string;
	page?: number;
	limit?: number;
}
