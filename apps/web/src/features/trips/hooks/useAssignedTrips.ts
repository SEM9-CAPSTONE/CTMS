import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { HttpError, queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripsService } from "../services/trips.service";
import type { PorterAssignedTrip, PorterTripOperations } from "../types";

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
	const porterId = getStoredAuthUser()?.id;
	const query = useQuery<PorterAssignedTrip[], unknown>({
		queryKey: [...queryKeys.trips.assigned, porterId ?? "anonymous"],
		queryFn: loadAssignedTrips,
		enabled: !!porterId,
		retry: false,
		staleTime: 15_000,
		refetchInterval: 15_000,
	});

	return {
		trips: porterId ? (query.data ?? []) : [],
		isLoading: !!porterId && query.isLoading,
		error: !porterId
			? "Vui lòng đăng nhập để xem chuyến đi được phân công."
			: query.error
				? assignedTripsError(query.error)
				: null,
		refetch: query.refetch,
		isStale: query.isStale,
		updatedAt: query.dataUpdatedAt || null,
	};
}

export function useAssignedTripOperations(tripId: string | null) {
	const queryClient = useQueryClient();
	const porterId = getStoredAuthUser()?.id;
	const query = useQuery<PorterTripOperations, unknown>({
		queryKey: queryKeys.trips.assignedOperations(porterId ?? "anonymous", tripId ?? ""),
		queryFn: () => tripsService.getAssignedTripOperations(tripId ?? ""),
		enabled: !!tripId && !!porterId,
		retry: false,
		staleTime: 15_000,
		refetchInterval: 15_000,
	});
	const isRevoked = query.error instanceof HttpError && [403, 404].includes(query.error.status);
	useEffect(() => {
		if (isRevoked && porterId)
			void queryClient.invalidateQueries({
				queryKey: [...queryKeys.trips.assigned, porterId],
				exact: true,
			});
	}, [isRevoked, porterId, queryClient]);
	return {
		data: !porterId || query.error ? undefined : query.data,
		isLoading: !!tripId && !!porterId && query.isPending,
		isStale: query.isStale,
		error: query.error
			? isRevoked
				? "Phân công không còn hợp lệ hoặc bạn không có quyền xem chuyến đi này."
				: assignedTripsError(query.error)
			: null,
		refetch: query.refetch,
	};
}
