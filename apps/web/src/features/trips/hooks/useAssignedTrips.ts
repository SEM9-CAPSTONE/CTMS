import { useQuery } from "@tanstack/react-query";
import { HttpError, queryKeys } from "../../../core/api";
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
	const query = useQuery<PorterAssignedTrip[], unknown>({
		queryKey: queryKeys.trips.assigned,
		queryFn: loadAssignedTrips,
		retry: false,
		staleTime: 15_000,
	});

	return {
		trips: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error ? assignedTripsError(query.error) : null,
		refetch: query.refetch,
	};
}
