import { useCallback, useEffect, useRef, useState } from "react";
import { bookingRefundService } from "../services/booking-refund.service";
import type {
	BookingRefundInfo,
	ProcessRefundRequest,
	ProcessRefundResponse,
	RefundError,
} from "../types";
import { mapBookingRefundError } from "./booking-refund-error";

export function useBookingRefund(bookingId: string) {
	const [refundInfo, setRefundInfo] = useState<BookingRefundInfo | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<RefundError | null>(null);
	const [actionError, setActionError] = useState<RefundError | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [lastResponse, setLastResponse] = useState<ProcessRefundResponse | null>(null);

	const requestSequence = useRef(0);
	const inFlight = useRef(false);

	const load = useCallback(
		async (silent = false) => {
			if (!bookingId) return;
			const sequence = ++requestSequence.current;
			if (silent) {
				setIsRefreshing(true);
			} else {
				setIsLoading(true);
				setError(null);
			}

			try {
				const info = await bookingRefundService.getRefundInfo(bookingId);
				if (sequence === requestSequence.current) {
					setRefundInfo(info);
					setError(null);
				}
			} catch (err) {
				if (sequence === requestSequence.current) {
					setError(mapBookingRefundError(err));
				}
			} finally {
				if (sequence === requestSequence.current) {
					setIsLoading(false);
					setIsRefreshing(false);
				}
			}
		},
		[bookingId]
	);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	const requestRefund = useCallback(
		async (payload: ProcessRefundRequest) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setActionError(null);

			const idempotencyKey =
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: `refund-${Date.now()}`;

			try {
				const response = await bookingRefundService.requestRefund(
					bookingId,
					payload,
					idempotencyKey
				);
				setLastResponse(response);
				setActionError(null);
				await load(true);
				return response;
			} catch (err) {
				const mapped = mapBookingRefundError(err);
				setActionError(mapped);
				throw mapped;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[bookingId, load]
	);

	const processObligation = useCallback(
		async (obligationId: string) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setActionError(null);

			const idempotencyKey =
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: `process-${Date.now()}`;

			try {
				const response = await bookingRefundService.processObligation(
					bookingId,
					obligationId,
					idempotencyKey
				);
				setLastResponse(response);
				setActionError(null);
				await load(true);
				return response;
			} catch (err) {
				const mapped = mapBookingRefundError(err);
				setActionError(mapped);
				throw mapped;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[bookingId, load]
	);

	const clearError = useCallback(() => {
		setActionError(null);
		setError(null);
	}, []);

	return {
		refundInfo,
		isLoading,
		isRefreshing,
		isError: Boolean(actionError ?? error),
		error: actionError ?? error,
		clearError,
		isSubmitting,
		reload: () => load(true),
		requestRefund,
		processObligation,
		lastResponse,
	};
}
