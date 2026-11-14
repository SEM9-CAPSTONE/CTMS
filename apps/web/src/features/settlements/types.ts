export interface TripSettlementEvaluation {
	tripId: string;
	tripTitle: string;
	hostId: string;
	hostName: string;
	tripStatus: string;
	completedAt: string | null;
	hoursSinceCompleted: number | null;
	isCompleted: boolean;
	isHoldPeriodSatisfied: boolean;
	isComplaintWindowSatisfied: boolean;
	isBlocked: boolean;
	blockingReasons: string[];
	isEligible: boolean;
	isSettled: boolean;
	settledAt: string | null;
	totalCharges: string;
	totalSucceededRefunds: string;
	settlementBase: string;
	commissionRate: string;
	platformFee: string;
	hostNetAmount: string;
}

export interface SettlementResponse {
	id: string;
	tripId: string;
	hostId: string;
	settlementBase: string;
	commissionRate: string;
	platformFee: string;
	netAmount: string;
	settledAt: string;
	walletBalanceAfter: string;
}

export interface WalletTransactionItem {
	id: string;
	type: string;
	baseAmount: string;
	feeAmount: string;
	netAmount: string;
	balanceAfter: string;
	description: string;
	createdAt: string;
}

export interface PendingPayoutInfo {
	id: string;
	amount: string;
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
	createdAt: string;
}

export interface HostWalletData {
	id: string;
	hostId: string;
	balance: string;
	pendingPayout?: PendingPayoutInfo | null;
	transactions: WalletTransactionItem[];
}

export interface RequestPayoutPayload {
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
	notes?: string;
}

export interface AdminPayoutItem {
	id: string;
	hostId: string;
	hostName: string;
	hostEmail: string | null;
	hostPhone: string | null;
	walletId: string;
	amount: string;
	status: "pending" | "succeeded" | "failed";
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
	transactionRef: string | null;
	rejectionReason: string | null;
	adminNotes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminSettlementsListResponse {
	items: TripSettlementEvaluation[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface AdminPayoutsListResponse {
	items: AdminPayoutItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export type FinancialAdjustmentType = "post_settlement_refund" | "post_payout_recovery";
export type FinancialAdjustmentStatus = "pending" | "resolved";

export interface FinancialAdjustmentItem {
	refundPaymentId?: string | null;
	refundStatus?: "pending" | "succeeded" | "failed" | null;
	id: string;
	settlementId: string | null;
	payoutId: string | null;
	bookingId: string;
	camperName: string;
	bookingCreatedAt: string | null;
	settledAt: string | null;
	payoutRequestedAt: string | null;
	tripId: string;
	tripTitle: string;
	hostId: string;
	hostName: string;
	type: FinancialAdjustmentType;
	amount: string;
	reason: string;
	status: FinancialAdjustmentStatus;
	actorId: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminAdjustmentsListResponse {
	items: FinancialAdjustmentItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface ReconcileExceptionPayload {
	bookingId: string;
	reason: string;
	notes?: string;
}

export interface ReconciliationBookingOption {
	id: string;
	tripTitle: string;
	camperName: string;
	createdAt: string;
	amount: string;
}

export interface ReconciliationBookingsResponse {
	items: ReconciliationBookingOption[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface ResolveAdjustmentPayload {
	notes?: string;
}
