import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { bookingDetailsService } from "../services/booking-details.service";
import type { BookingDetails, BookingDetailsError } from "../types";

export function mapBookingDetailsError(error: unknown): BookingDetailsError {
	if (!(error instanceof HttpError)) {
		return {
			kind: "retryable",
			message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.",
			canRetry: true,
		};
	}

	switch (error.status) {
		case 401:
			return {
				kind: "unauthenticated",
				message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
				canRetry: false,
			};
		case 403:
			return {
				kind: "forbidden",
				message: "Bạn không có quyền xem đơn đặt chỗ này.",
				canRetry: false,
			};
		case 404:
			return {
				kind: "not_found",
				message: "Không tìm thấy đơn đặt chỗ",
				canRetry: false,
			};
		case 422:
			return {
				kind: "invalid_reference",
				message: "Mã đơn đặt chỗ không hợp lệ.",
				canRetry: false,
			};
		default:
			if (error.status >= 500) {
				return {
					kind: "retryable",
					message: "Không thể tải chi tiết đơn đặt chỗ. Vui lòng thử lại.",
					canRetry: true,
				};
			}
			return {
				kind: "unexpected",
				message: "Không thể tải chi tiết đơn đặt chỗ.",
				canRetry: false,
			};
	}
}

export function useBookingDetails(bookingId: string) {
	const [booking, setBooking] = useState<BookingDetails | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<BookingDetailsError | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [refreshError, setRefreshError] = useState<BookingDetailsError | null>(null);
	const requestSequence = useRef(0);

	const load = useCallback(
		async (keepBooking = false) => {
			const sequence = ++requestSequence.current;
			setRefreshError(null);
			if (keepBooking) setIsRefreshing(true);
			else {
				setBooking(null);
				setError(null);
				setIsLoading(true);
			}

			try {
				const result = await bookingDetailsService.getBookingDetails(bookingId);
				if (sequence === requestSequence.current) setBooking(result);
			} catch (requestError) {
				if (sequence === requestSequence.current) {
					if (keepBooking) setRefreshError(mapBookingDetailsError(requestError));
					else setError(mapBookingDetailsError(requestError));
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

	const reload = useCallback(() => load(true), [load]);
	return { booking, isLoading, error, retry: load, reload, isRefreshing, refreshError };
}
