import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import {
	type TripWeatherChangedEvent,
	weatherChangeNoticesService,
} from "../services/weather-change-notices.service";

/** Fallback refresh when the socket is down; the socket event refreshes immediately. */
export const WEATHER_CHANGE_NOTICE_POLL_MS = 60_000;

/**
 * Weather change notices of the signed-in Host or Camper. A `trip.weather.changed` socket event
 * reloads the list at once and refreshes that Trip's forecast and history if they are on screen.
 */
export function useWeatherChangeNotices(
	options: {
		connection?: RealtimeConnection;
		service?: typeof weatherChangeNoticesService;
		/** false for Admins, who get only decision reminders (CTMS-60). */
		enabled?: boolean;
	} = {}
) {
	const { connection, service = weatherChangeNoticesService } = options;
	const userId = getStoredAuthUser()?.id ?? "";
	const enabled =
		(options.enabled ?? true) && Boolean(userId && localStorage.getItem("accessToken"));
	const client = useQueryClient();
	const key = queryKeys.weather.changeNotices(userId);
	const query = useQuery({
		queryKey: key,
		queryFn: service.list,
		enabled,
		refetchInterval: WEATHER_CHANGE_NOTICE_POLL_MS,
	});
	const markRead = useMutation({
		mutationFn: service.markRead,
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
	useRealtimeConnection(enabled, connection);
	useRealtimeEvent<TripWeatherChangedEvent>(
		"trip.weather.changed",
		(event) => {
			void client.invalidateQueries({ queryKey: key });
			if (!event?.tripId) return;
			void client.invalidateQueries({ queryKey: queryKeys.trips.tripDatesWeather(event.tripId) });
			void client.invalidateQueries({
				queryKey: queryKeys.trips.tripWeatherHistory(event.tripId),
			});
		},
		enabled,
		connection
	);
	return { query, markRead, unread: query.data?.unreadCount ?? 0 };
}
