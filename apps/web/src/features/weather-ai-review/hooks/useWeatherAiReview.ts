import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { weatherAiReviewService } from "../services/weather-ai-review.service";

type Service = typeof weatherAiReviewService;

/** AI opinions only change when the monitor runs (every 15 min), so a slow poll is enough. */
export const WEATHER_AI_MISMATCH_POLL_MS = 5 * 60_000;

/** Trips whose thresholds and AI disagree, widest gap first (Admin). */
export function useWeatherAiMismatches(enabled = true, service: Service = weatherAiReviewService) {
	return useQuery({
		queryKey: queryKeys.weather.aiMismatches,
		queryFn: service.listMismatches,
		enabled,
		refetchInterval: WEATHER_AI_MISMATCH_POLL_MS,
	});
}

/** Marks a disagreement as seen and refreshes the list. */
export function useAcknowledgeWeatherAiMismatch(service: Service = weatherAiReviewService) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (forecastId: string) => service.acknowledge(forecastId),
		onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.weather.aiMismatches }),
	});
}
