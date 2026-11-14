import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { SETTLEMENT_QUERY_CONFIG } from "../constants";
import { settlementService } from "../services/settlement.service";
import type {
	ReconcileExceptionPayload,
	RequestPayoutPayload,
	ResolveAdjustmentPayload,
} from "../types";

export function useTripSettlementEvaluation(tripId: string, enabled = true) {
	return useQuery({
		queryKey: queryKeys.settlements.evaluation(tripId),
		queryFn: () => settlementService.getTripEvaluation(tripId),
		enabled: Boolean(tripId) && enabled,
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
		refetchInterval: SETTLEMENT_QUERY_CONFIG.refetchInterval,
	});
}

export function useSettleTrip() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (tripId: string) => settlementService.settleTrip(tripId),
		onSuccess: (_data, tripId) => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.evaluation(tripId),
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.all,
			});
		},
	});
}

export function useAdminSettlements(
	params?: {
		status?: string;
		search?: string;
		page?: number;
		limit?: number;
	},
	enabled = true
) {
	return useQuery({
		queryKey: queryKeys.settlements.adminList(params as Record<string, unknown>),
		queryFn: () => settlementService.getAdminSettlements(params),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
		enabled,
	});
}

export function useHostWallet() {
	return useQuery({
		queryKey: queryKeys.settlements.hostWallet,
		queryFn: () => settlementService.getHostWallet(),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
		refetchInterval: SETTLEMENT_QUERY_CONFIG.refetchInterval,
	});
}

export function useRequestHostPayout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: RequestPayoutPayload) => settlementService.requestHostPayout(payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.hostWallet,
			});
		},
	});
}

export function useAdminPayouts(
	params?: {
		status?: string;
		search?: string;
		page?: number;
		limit?: number;
	},
	enabled = true
) {
	return useQuery({
		queryKey: queryKeys.settlements.adminPayouts(params as Record<string, unknown>),
		queryFn: () => settlementService.getAdminPayouts(params),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
		enabled,
	});
}

export function useConfirmPayout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			payoutId,
			payload,
		}: {
			payoutId: string;
			payload: { transactionRef: string; adminNotes?: string };
		}) => settlementService.confirmAdminPayout(payoutId, payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.all,
			});
		},
	});
}

export function useRejectPayout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			payoutId,
			payload,
		}: {
			payoutId: string;
			payload: { rejectionReason: string };
		}) => settlementService.rejectAdminPayout(payoutId, payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.all,
			});
		},
	});
}

export function useReconcileException() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: ReconcileExceptionPayload) =>
			settlementService.reconcileException(payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.all,
			});
		},
	});
}

export function useReconciliationBookings(search: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.settlements.reconciliationBookings(search),
		queryFn: () => settlementService.getReconciliationBookings(search),
		enabled,
	});
}

export function useAdminAdjustments(
	params?: {
		type?: string;
		status?: string;
		tripId?: string;
		bookingId?: string;
		search?: string;
		page?: number;
		limit?: number;
	},
	enabled = true
) {
	return useQuery({
		queryKey: queryKeys.settlements.adminAdjustments(params as Record<string, unknown>),
		queryFn: () => settlementService.getAdminAdjustments(params),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
		enabled,
	});
}

export function useResolveAdjustment() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			payload,
		}: {
			id: string;
			payload: ResolveAdjustmentPayload;
		}) => settlementService.resolveAdjustment(id, payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.settlements.all,
			});
		},
	});
}
