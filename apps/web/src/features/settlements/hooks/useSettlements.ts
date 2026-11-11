import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { SETTLEMENT_QUERY_CONFIG } from "../constants";
import { settlementService } from "../services/settlement.service";
import type { RequestPayoutPayload } from "../types";

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

export function useAdminSettlements(params?: {
	status?: string;
	search?: string;
	page?: number;
	limit?: number;
}) {
	return useQuery({
		queryKey: queryKeys.settlements.adminList(params as Record<string, unknown>),
		queryFn: () => settlementService.getAdminSettlements(params),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
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

export function useAdminPayouts(params?: {
	status?: string;
	search?: string;
	page?: number;
	limit?: number;
}) {
	return useQuery({
		queryKey: queryKeys.settlements.adminPayouts(params as Record<string, unknown>),
		queryFn: () => settlementService.getAdminPayouts(params),
		staleTime: SETTLEMENT_QUERY_CONFIG.staleTime,
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
