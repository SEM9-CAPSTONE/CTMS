import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { bookingListService } from "../services/booking-list.service";
import type { BookingListError, BookingListItem } from "../types";

export function mapBookingListError(error: unknown): BookingListError {
	if (!(error instanceof HttpError)) {
		return {
			kind: "retryable",
			message: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
			canRetry: true,
		};
	}
	if (error.status === 401) {
		return {
			kind: "unauthenticated",
			message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
			canRetry: false,
		};
	}
	if (error.status === 403) {
		return {
			kind: "forbidden",
			message: "Bạn không có quyền xem danh sách đơn đặt chỗ.",
			canRetry: false,
		};
	}
	if (error.status >= 500) {
		return {
			kind: "retryable",
			message: "Không thể tải danh sách đơn đặt chỗ. Vui lòng thử lại.",
			canRetry: true,
		};
	}
	return {
		kind: "unexpected",
		message: "Không thể tải danh sách đơn đặt chỗ.",
		canRetry: false,
	};
}

export function useBookingList() {
	const [bookings, setBookings] = useState<BookingListItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<BookingListError | null>(null);
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		setBookings([]);
		setError(null);
		setIsLoading(true);
		try {
			const result = await bookingListService.getMyBookings();
			if (sequence === requestSequence.current) setBookings(result);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(mapBookingListError(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { bookings, isLoading, error, retry: load };
}
