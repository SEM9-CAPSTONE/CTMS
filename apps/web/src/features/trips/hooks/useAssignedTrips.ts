import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PorterAssignedTrip } from "../types";

function assignedTripsError(error: unknown): string {
	if (error instanceof HttpError && error.status === 403)
		return "Bạn không có quyền xem danh sách chuyến đi được phân công.";
	if (error instanceof HttpError && error.status === 401)
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	return "Không thể tải danh sách chuyến đi được phân công. Vui lòng thử lại.";
}

const loadAssignedTripsFromService = () => tripsService.getAssignedTrips();

export function useAssignedTrips(
	loadAssignedTrips: () => Promise<PorterAssignedTrip[]> = loadAssignedTripsFromService
) {
	const [trips, setTrips] = useState<PorterAssignedTrip[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const generation = useRef(0);

	const refetch = useCallback(async () => {
		const attempt = generation.current;
		setIsLoading(true);
		setError(null);
		try {
			const response = await loadAssignedTrips();
			if (attempt !== generation.current) return null;
			setTrips(response);
			return response;
		} catch (requestError) {
			if (attempt === generation.current) setError(assignedTripsError(requestError));
			return null;
		} finally {
			if (attempt === generation.current) setIsLoading(false);
		}
	}, [loadAssignedTrips]);

	useEffect(() => {
		generation.current += 1;
		void refetch();
		return () => {
			generation.current += 1;
		};
	}, [refetch]);

	return { trips, isLoading, error, refetch };
}
