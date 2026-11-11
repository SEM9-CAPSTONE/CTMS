export type PaymentStatus = "pending" | "succeeded" | "failed";

export type PaymentTransactionStatus = "pending" | "succeeded" | "failed";

export type RefundOrigin =
	| "camper_cancellation"
	| "camper_complaint"
	| "host_trip_cancellation"
	| "system_trip_cancellation"
	| "late_payment_after_expiry";

export interface BookingRefundItem {
	id: string;
	amount: string;
	status: PaymentStatus;
	transactionStatus?: PaymentTransactionStatus;
	providerReference?: string | null;
	failureReason?: string | null;
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolderName?: string | null;
	reason?: string | null;
	note?: string | null;
	createdAt: string;
}

export interface BookingRefundApplicableWindow {
	startsAt?: string;
	endsAt?: string;
	deadline?: string;
	isExpired: boolean;
	description: string;
}

export interface BookingRefundInfo {
	bookingId: string;
	isEligible: boolean;
	ineligibleReason?: string;
	origin?: RefundOrigin;
	policySource?: string;
	applicableWindow?: BookingRefundApplicableWindow;
	chargeAmount?: string;
	totalRefundedAmount: string;
	remainingRefundableAmount: string;
	refunds: BookingRefundItem[];
	settlementBlocked: boolean;
	awaitingResolution: boolean;
}

export interface ProcessRefundRequest {
	obligationId?: string;
	origin?: RefundOrigin;
	amount?: string;
	reason?: string;
	bankName?: string;
	accountNumber?: string;
	accountHolderName?: string;
}

export interface ProcessRefundResponse {
	refundId: string;
	bookingId: string;
	parentPaymentId: string;
	amount: string;
	status: PaymentStatus;
	transactionStatus: PaymentTransactionStatus;
	providerReference?: string | null;
	policySource: string;
	createdAt: string;
}

export type RefundErrorKind =
	| "validation"
	| "forbidden"
	| "not_found"
	| "conflict_window"
	| "conflict_cap"
	| "provider_error"
	| "retryable"
	| "unexpected";

export interface RefundError {
	kind: RefundErrorKind;
	message: string;
	canRetry: boolean;
}
