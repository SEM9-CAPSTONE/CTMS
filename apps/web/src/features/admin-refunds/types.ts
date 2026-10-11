import type { PaymentStatus, PaymentTransactionStatus } from "../booking-refund/types";

export interface AdminRefundBeneficiary {
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolderName?: string | null;
}

export interface AdminRefundCamper {
	id: string;
	fullName: string;
	email?: string | null;
	phone?: string | null;
}

export interface AdminRefundItem {
	id: string;
	bookingId: string;
	tripTitle?: string;
	camper: AdminRefundCamper;
	amount: string;
	status: PaymentStatus;
	transactionStatus?: PaymentTransactionStatus;
	providerReference?: string | null;
	reason?: string | null;
	rejectionReason?: string | null;
	note?: string | null;
	beneficiary?: AdminRefundBeneficiary;
	createdAt: string;
	updatedAt: string;
}

export interface AdminRefundListResponse {
	items: AdminRefundItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface AdminRefundFilter {
	page?: number;
	limit?: number;
	status?: PaymentStatus;
	search?: string;
}

export interface ConfirmManualRefundPayload {
	transactionRef: string;
	note?: string;
}

export interface RejectRefundPayload {
	rejectionReason: string;
}
