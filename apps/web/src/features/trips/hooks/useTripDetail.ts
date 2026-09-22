import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripDetails } from "../types";

export function useTripDetail(tripId: string | undefined) {
	const [trip, setTrip] = useState<TripDetails | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [isNotFound, setIsNotFound] = useState<boolean>(false);

	const tripIdRef = useRef(tripId);
	tripIdRef.current = tripId;

	const fetchTrip = useCallback(async (id: string | undefined) => {
		if (!id) {
			setTrip(null);
			setIsLoading(false);
			setIsNotFound(true);
			setError("Không tìm thấy mã chuyến đi.");
			return;
		}

		setIsLoading(true);
		setError(null);
		setIsNotFound(false);

		try {
			const result = await tripsService.getById(id);
			if (tripIdRef.current === id) {
				setTrip(result);
			}
		} catch (err) {
			if (tripIdRef.current === id) {
				if (err instanceof HttpError) {
					if (err.status === 404) {
						setIsNotFound(true);
						setError("Chuyến đi không tồn tại hoặc đã kết thúc.");
					} else if (err.status === 403) {
						setError("Bạn không có quyền truy cập chuyến đi này.");
					} else {
						setError("Không thể tải thông tin chuyến đi. Vui lòng thử lại.");
					}
				} else {
					setError("Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền.");
				}
			}
		} finally {
			if (tripIdRef.current === id) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		void fetchTrip(tripId);
	}, [tripId, fetchTrip]);

	const retry = useCallback(() => {
		return fetchTrip(tripIdRef.current);
	}, [fetchTrip]);

	return {
		trip,
		isLoading,
		error,
		isNotFound,
		retry,
	};
}
