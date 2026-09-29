export type PaymentStatus = "pending" | "succeeded" | "failed";

export type BookingWorkflowStatus =
	| "pending_payment"
	| "confirmed"
	| "cancelled"
	| "expired"
	| "completed";

export type BookingPaymentWorkflowStatus =
	| "unpaid"
	| "paid"
	| "partially_refunded"
	| "refunded"
	| "not_required";

export interface PayBookingRequest {
	method: string;
}

export interface PayBookingResponse {
	paymentId: string;
	bookingId: string;
	paymentStatus: PaymentStatus;
	amount: string;
	bookingStatus: BookingWorkflowStatus;
	bookingPaymentStatus: BookingPaymentWorkflowStatus;
	createdAt: string;
	checkoutUrl?: string | null;
	qrCode?: string | null;
}

export interface BookingPaymentError {
	status?: number;
	message: string;
	isConflict: boolean;
	canRetry: boolean;
	fieldErrors: Record<string, string>;
}

export interface PaymentMethodOption {
	id: string;
	label: string;
	description: string;
	disabled?: boolean;
	badge?: string;
}
