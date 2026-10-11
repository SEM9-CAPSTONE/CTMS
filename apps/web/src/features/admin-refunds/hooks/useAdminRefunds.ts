import { useCallback, useEffect, useRef, useState } from "react";
import { adminRefundsService } from "../services/admin-refunds.service";
import type {
	AdminRefundFilter,
	AdminRefundListResponse,
	ConfirmManualRefundPayload,
	RejectRefundPayload,
} from "../types";

export function useAdminRefunds(filter: AdminRefundFilter = {}) {
	const { page = 1, limit = 20, status, search } = filter;
	const [refundsData, setRefundsData] = useState<AdminRefundListResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const [isRejecting, setIsRejecting] = useState(false);

	const requestSequence = useRef(0);

	const fetchRefunds = useCallback(async () => {
		const seq = ++requestSequence.current;
		setIsLoading(true);
		setIsError(false);
		setError(null);

		try {
			const data = await adminRefundsService.getRefunds({
				page,
				limit,
				status,
				search,
			});
			if (seq === requestSequence.current) {
				setRefundsData(data);
			}
		} catch (err) {
			if (seq === requestSequence.current) {
				setIsError(true);
				setError(err instanceof Error ? err : new Error("Failed to load refunds"));
			}
		} finally {
			if (seq === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [page, limit, status, search]);

	useEffect(() => {
		void fetchRefunds();
		return () => {
			requestSequence.current += 1;
		};
	}, [fetchRefunds]);

	const confirmTransfer = useCallback(
		async ({
			obligationId,
			payload,
		}: {
			obligationId: string;
			payload: ConfirmManualRefundPayload;
		}) => {
			setIsConfirming(true);
			try {
				const res = await adminRefundsService.confirmTransfer(obligationId, payload);
				await fetchRefunds();
				return res;
			} finally {
				setIsConfirming(false);
			}
		},
		[fetchRefunds]
	);

	const rejectRefund = useCallback(
		async ({
			obligationId,
			payload,
		}: {
			obligationId: string;
			payload: RejectRefundPayload;
		}) => {
			setIsRejecting(true);
			try {
				const res = await adminRefundsService.rejectRefund(obligationId, payload);
				await fetchRefunds();
				return res;
			} finally {
				setIsRejecting(false);
			}
		},
		[fetchRefunds]
	);

	return {
		refundsData,
		isLoading,
		isError,
		error,
		refetch: fetchRefunds,
		confirmTransfer,
		isConfirming,
		rejectRefund,
		isRejecting,
	};
}
