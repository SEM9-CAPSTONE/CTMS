import {
	tripDatesWeatherErrorMessage,
	useTripDatesWeatherForecast,
} from "../hooks/useTripDatesWeatherForecast";
import type { TripWeatherForecast } from "../types";
import { TripWeatherForecastCard } from "./TripWeatherForecastCard";
import { TripWeatherHistory } from "./TripWeatherHistory";

/**
 * Traveller view of the forecast for the Trip's own dates, on the Trip page before booking and on
 * the Booking page afterwards. Reuses the shared Trip forecast card.
 */
export function TripDatesWeatherCard({
	tripId,
	enabled = true,
	fetchForecast,
	fetchHistory,
}: {
	tripId: string;
	enabled?: boolean;
	fetchForecast?: (tripId: string) => Promise<TripWeatherForecast>;
	fetchHistory?: (tripId: string) => Promise<TripWeatherForecast[]>;
}) {
	const query = useTripDatesWeatherForecast(tripId, enabled, fetchForecast);
	if (!enabled) return null;
	return (
		<TripWeatherForecastCard
			variant="traveller"
			forecast={query.data ?? null}
			isLoading={query.isPending}
			error={query.isError ? tripDatesWeatherErrorMessage(query.error) : null}
			onRetry={() => void query.refetch()}
		>
			{query.data && <TripWeatherHistory tripId={tripId} fetchHistory={fetchHistory} />}
		</TripWeatherForecastCard>
	);
}
