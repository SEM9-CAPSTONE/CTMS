import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../services/trips.service";
import type { TripWeatherForecast } from "../types";

/** Forecast history of a Trip (one row per change, newest first); loaded only when opened. */
export function useTripWeatherHistory(
	tripId: string,
	enabled: boolean,
	fetchHistory: (
		tripId: string
	) => Promise<TripWeatherForecast[]> = tripsService.getTripWeatherHistory
) {
	return useQuery({
		queryKey: queryKeys.trips.tripWeatherHistory(tripId),
		queryFn: () => fetchHistory(tripId),
		enabled: enabled && Boolean(tripId),
		retry: false,
	});
}
