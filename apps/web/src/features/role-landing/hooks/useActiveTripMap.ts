import { skipToken, useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { activeTripMapService } from "../services/active-trip-map.service";
import type { ParticipantSelection } from "../types/active-trip-map";

const REFRESH_INTERVAL = 30_000;

export function useActiveTripMaps(hostId: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.trekking.activeTripMaps(hostId),
		queryFn: ({ signal }) => activeTripMapService.list(signal),
		enabled,
		refetchInterval: REFRESH_INTERVAL,
		retry: false,
	});
}

export function useMapParticipant(hostId: string, selection?: ParticipantSelection) {
	return useQuery({
		queryKey: queryKeys.trekking.mapParticipant(
			hostId,
			selection?.tripId,
			selection?.role,
			selection?.participantId
		),
		queryFn: selection
			? ({ signal }) => activeTripMapService.participant(selection, signal)
			: skipToken,
		refetchInterval: selection ? REFRESH_INTERVAL : false,
		retry: false,
	});
}

export function usePositionClock() {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 15_000);
		return () => window.clearInterval(timer);
	}, []);
	return now;
}

export function useRefreshHostMonitoring(hostId: string) {
	const client = useQueryClient();
	const fetching = useIsFetching({ predicate: (query) => query.queryKey.includes(hostId) });
	return {
		isRefreshing: fetching > 0,
		refresh: () =>
			Promise.all([
				client.invalidateQueries({ queryKey: queryKeys.trekking.activeTripMaps(hostId) }),
				client.invalidateQueries({ queryKey: ["host-monitoring", hostId, "participant"] }),
				client.invalidateQueries({ queryKey: queryKeys.trips.hostOverview(hostId) }),
				client.invalidateQueries({ queryKey: queryKeys.trips.hostOverviewAssignments(hostId) }),
			]),
	};
}
