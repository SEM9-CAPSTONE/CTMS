import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripBookingsResponse } from "../types";

function extractErrorMessage(error: unknown): string {
	const status =
		error instanceof HttpError
			? error.status
			: typeof error === "object" && error !== null && "status" in error
				? (error as { status: unknown }).status
				: undefined;

	if (status === 403) return "Bạn không có quyền xem thông tin đặt chỗ của chuyến đi này.";
	if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	if (status === 404) return "Không tìm thấy dữ liệu chuyến đi.";
	return "Không thể tải danh sách đặt chỗ & thiết bị. Vui lòng thử lại.";
}

export function useTripBookings(tripId: string | null) {
	const [data, setData] = useState<TripBookingsResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		if (!tripId) {
			setData(null);
			setIsLoading(false);
			setError("");
			return;
		}

		const sequence = ++requestSequence.current;
		setError("");
		setIsLoading(true);

		try {
			const res = await tripsService.getTripBookings(tripId);
			if (sequence === requestSequence.current) {
				setData(res);
			}
		} catch (err) {
			if (sequence === requestSequence.current) {
				setError(extractErrorMessage(err));
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [tripId]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return {
		data,
		bookings: data?.bookings ?? [],
		equipmentSummary: data?.equipmentSummary ?? [],
		isLoading,
		error,
		refetch: load,
	};
}
