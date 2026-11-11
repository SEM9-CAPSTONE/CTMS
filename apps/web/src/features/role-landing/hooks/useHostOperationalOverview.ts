import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../../trips/services/trips.service";
import { buildHostOperationalOverview } from "../utils/host-operational-overview";

const REFRESH_INTERVAL_MS = 30_000;

export function useHostOperationalOverview(hostId: string) {
	const tripsQuery = useQuery({
		queryKey: queryKeys.trips.hostOverview(hostId),
		queryFn: () => tripsService.getMyTrips(),
		refetchInterval: REFRESH_INTERVAL_MS,
		retry: false,
	});
	const assignmentsQuery = useQuery({
		queryKey: queryKeys.trips.hostOverviewAssignments(hostId),
		queryFn: () => tripsService.getHostPorterAssignments(),
		refetchInterval: REFRESH_INTERVAL_MS,
		retry: false,
	});
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const refresh = () => setNow(Date.now());
		const timer = window.setInterval(refresh, 1000);
		window.addEventListener("focus", refresh);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("focus", refresh);
		};
	}, []);
	return {
		...buildHostOperationalOverview(tripsQuery.data ?? [], assignmentsQuery.data ?? [], now),
		isLoading: tripsQuery.isPending,
		isError: tripsQuery.isError,
		portersUnavailable: assignmentsQuery.isPending || assignmentsQuery.isError,
		isRefreshing: tripsQuery.isFetching || assignmentsQuery.isFetching,
		updatedAt: tripsQuery.dataUpdatedAt,
		refresh: () => {
			void tripsQuery.refetch();
			void assignmentsQuery.refetch();
		},
	};
}
