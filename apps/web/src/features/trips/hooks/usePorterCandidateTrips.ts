import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripDetails } from "../types";

function listErrorMessage(error: unknown): string {
	const status = error instanceof HttpError ? error.status : undefined;
	if (status === 403) return "Bạn không có quyền Host để xem danh sách chuyến đi.";
	if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	return "Không thể tải danh sách Trip cần Porter. Vui lòng thử lại.";
}

export function usePorterCandidateTrips() {
	const [trips, setTrips] = useState<TripDetails[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		setError("");
		setIsLoading(true);
		try {
			const data = await tripsService.getPorterCandidateTrips();
			if (sequence === requestSequence.current) setTrips(data);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
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

	return { trips, isLoading, error, refetch: load };
}
