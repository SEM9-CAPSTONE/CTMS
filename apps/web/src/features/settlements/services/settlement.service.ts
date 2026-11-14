import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type {
	AdminAdjustmentsListResponse,
	AdminPayoutsListResponse,
	AdminSettlementsListResponse,
	FinancialAdjustmentItem,
	HostWalletData,
	ReconcileExceptionPayload,
	ReconciliationBookingsResponse,
	RequestPayoutPayload,
	ResolveAdjustmentPayload,
	SettlementResponse,
	TripSettlementEvaluation,
} from "../types";

export const settlementService = {
	getReconciliationBookings: (search = ""): Promise<ReconciliationBookingsResponse> => {
		const query = new URLSearchParams({ search });
		return httpClient.get<ReconciliationBookingsResponse>(
			`${API_ENDPOINTS.SETTLEMENTS.ADMIN_RECONCILIATION_BOOKINGS}?${query}`
		);
	},
	getTripEvaluation: async (tripId: string): Promise<TripSettlementEvaluation> => {
		return httpClient.get<TripSettlementEvaluation>(API_ENDPOINTS.SETTLEMENTS.EVALUATION(tripId));
	},

	settleTrip: async (tripId: string): Promise<SettlementResponse> => {
		return httpClient.post<SettlementResponse>(API_ENDPOINTS.SETTLEMENTS.SETTLE(tripId), {});
	},

	getAdminSettlements: async (params?: {
		status?: string;
		search?: string;
		page?: number;
		limit?: number;
	}): Promise<AdminSettlementsListResponse> => {
		const searchParams = new URLSearchParams();
		if (params?.status && params.status !== "all") {
			searchParams.set("status", params.status);
		}
		if (params?.search?.trim()) {
			searchParams.set("search", params.search.trim());
		}
		if (params?.page) {
			searchParams.set("page", String(params.page));
		}
		if (params?.limit) {
			searchParams.set("limit", String(params.limit));
		}

		const queryString = searchParams.toString();
		const endpoint = queryString
			? `${API_ENDPOINTS.SETTLEMENTS.ADMIN_LIST}?${queryString}`
			: API_ENDPOINTS.SETTLEMENTS.ADMIN_LIST;

		return httpClient.get<AdminSettlementsListResponse>(endpoint);
	},

	getHostWallet: async (): Promise<HostWalletData> => {
		return httpClient.get<HostWalletData>(API_ENDPOINTS.SETTLEMENTS.HOST_WALLET);
	},

	requestHostPayout: async (payload: RequestPayoutPayload): Promise<unknown> => {
		return httpClient.post<unknown>(API_ENDPOINTS.SETTLEMENTS.HOST_PAYOUT, payload);
	},

	getAdminPayouts: async (params?: {
		status?: string;
		search?: string;
		page?: number;
		limit?: number;
	}): Promise<AdminPayoutsListResponse> => {
		const searchParams = new URLSearchParams();
		if (params?.status && params.status !== "all") {
			searchParams.set("status", params.status);
		}
		if (params?.search?.trim()) {
			searchParams.set("search", params.search.trim());
		}
		if (params?.page) {
			searchParams.set("page", String(params.page));
		}
		if (params?.limit) {
			searchParams.set("limit", String(params.limit));
		}

		const queryString = searchParams.toString();
		const endpoint = queryString
			? `${API_ENDPOINTS.SETTLEMENTS.ADMIN_PAYOUTS}?${queryString}`
			: API_ENDPOINTS.SETTLEMENTS.ADMIN_PAYOUTS;

		return httpClient.get<AdminPayoutsListResponse>(endpoint);
	},

	confirmAdminPayout: async (
		payoutId: string,
		payload: { transactionRef: string; adminNotes?: string }
	): Promise<unknown> => {
		return httpClient.post<unknown>(
			API_ENDPOINTS.SETTLEMENTS.ADMIN_CONFIRM_PAYOUT(payoutId),
			payload
		);
	},

	rejectAdminPayout: async (
		payoutId: string,
		payload: { rejectionReason: string }
	): Promise<unknown> => {
		return httpClient.post<unknown>(
			API_ENDPOINTS.SETTLEMENTS.ADMIN_REJECT_PAYOUT(payoutId),
			payload
		);
	},

	reconcileException: async (
		payload: ReconcileExceptionPayload
	): Promise<FinancialAdjustmentItem> => {
		return httpClient.post<FinancialAdjustmentItem>(
			API_ENDPOINTS.SETTLEMENTS.ADMIN_RECONCILE,
			payload
		);
	},

	getAdminAdjustments: async (params?: {
		type?: string;
		status?: string;
		tripId?: string;
		bookingId?: string;
		search?: string;
		page?: number;
		limit?: number;
	}): Promise<AdminAdjustmentsListResponse> => {
		const searchParams = new URLSearchParams();
		if (params?.type && params.type !== "all") {
			searchParams.set("type", params.type);
		}
		if (params?.status && params.status !== "all") {
			searchParams.set("status", params.status);
		}
		if (params?.tripId) {
			searchParams.set("tripId", params.tripId);
		}
		if (params?.bookingId) {
			searchParams.set("bookingId", params.bookingId);
		}
		if (params?.search?.trim()) {
			searchParams.set("search", params.search.trim());
		}
		if (params?.page) {
			searchParams.set("page", String(params.page));
		}
		if (params?.limit) {
			searchParams.set("limit", String(params.limit));
		}

		const queryString = searchParams.toString();
		const endpoint = queryString
			? `${API_ENDPOINTS.SETTLEMENTS.ADMIN_ADJUSTMENTS}?${queryString}`
			: API_ENDPOINTS.SETTLEMENTS.ADMIN_ADJUSTMENTS;

		return httpClient.get<AdminAdjustmentsListResponse>(endpoint);
	},

	resolveAdjustment: async (
		id: string,
		payload: ResolveAdjustmentPayload
	): Promise<FinancialAdjustmentItem> => {
		return httpClient.post<FinancialAdjustmentItem>(
			API_ENDPOINTS.SETTLEMENTS.ADMIN_RESOLVE_ADJUSTMENT(id),
			payload
		);
	},
};
