import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { weatherDecisionsService } from "../services/weather-decisions.service";
import type { WeatherDecisionInput } from "../types";

type Service = typeof weatherDecisionsService;

/** Fallback refresh when the socket is down; `trip.weather.decision_required` refreshes at once. */
export const WEATHER_DECISION_ALERT_POLL_MS = 60_000;

export function useWeatherDecisionLog(
	tripId: string,
	enabled = true,
	service: Service = weatherDecisionsService
) {
	return useQuery({
		queryKey: queryKeys.weather.decisionLog(tripId),
		queryFn: () => service.getLog(tripId),
		enabled: enabled && Boolean(tripId),
		retry: false,
	});
}

/** Records a Host or Admin decision, then refreshes the log, the Admin list and the reminders. */
export function useWeatherDecisionMutation(
	tripId: string,
	role: "host" | "admin",
	service: Service = weatherDecisionsService
) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: WeatherDecisionInput) =>
			role === "admin" ? service.decideAsAdmin(tripId, input) : service.decideAsHost(tripId, input),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: queryKeys.weather.decisionLog(tripId) });
			void client.invalidateQueries({ queryKey: queryKeys.weather.interventions });
			void client.invalidateQueries({ queryKey: ["weather", "decision-alerts"] });
		},
	});
}

export function useWeatherInterventions(
	enabled = true,
	service: Service = weatherDecisionsService
) {
	return useQuery({
		queryKey: queryKeys.weather.interventions,
		queryFn: service.listInterventions,
		enabled,
		refetchInterval: WEATHER_DECISION_ALERT_POLL_MS,
	});
}

/**
 * Weather decision reminders of the signed-in Host or Admin (T-48h, T-24h, T-12h, T-6h). A
 * `trip.weather.decision_required` socket event reloads them and the Admin intervention list.
 */
export function useWeatherDecisionAlerts(
	options: { enabled?: boolean; connection?: RealtimeConnection; service?: Service } = {}
) {
	const { connection, service = weatherDecisionsService } = options;
	const userId = getStoredAuthUser()?.id ?? "";
	const enabled =
		(options.enabled ?? true) && Boolean(userId && localStorage.getItem("accessToken"));
	const client = useQueryClient();
	const key = queryKeys.weather.decisionAlerts(userId);
	const query = useQuery({
		queryKey: key,
		queryFn: service.listAlerts,
		enabled,
		refetchInterval: WEATHER_DECISION_ALERT_POLL_MS,
	});
	const markRead = useMutation({
		mutationFn: service.markAlertRead,
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
	useRealtimeConnection(enabled, connection);
	useRealtimeEvent<{ tripId?: string }>(
		"trip.weather.decision_required",
		(event) => {
			void client.invalidateQueries({ queryKey: key });
			void client.invalidateQueries({ queryKey: queryKeys.weather.interventions });
			if (event?.tripId) {
				void client.invalidateQueries({ queryKey: queryKeys.weather.decisionLog(event.tripId) });
			}
		},
		enabled,
		connection
	);
	return { query, markRead, unread: query.data?.unreadCount ?? 0, enabled };
}

export function useWeatherRescheduleResponse(
	bookingId: string,
	service: Service = weatherDecisionsService
) {
	return useMutation({
		mutationFn: (accept: boolean) => service.respondToReschedule(bookingId, accept),
	});
}
