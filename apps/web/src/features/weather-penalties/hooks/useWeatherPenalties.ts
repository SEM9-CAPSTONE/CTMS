import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { toast } from "../../../shared/components/Toast";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { AdminPenaltyFilter, WaiverRequestInput, WaiverReviewInput } from "../types";

type Service = typeof weatherPenaltiesService;

/** Fallback refresh when the socket is down. */
export const WEATHER_PENALTY_POLL_MS = 60_000;

/**
 * The signed-in Host's weather penalties. `host.weather_penalty.created` reloads them and the
 * wallet (a deduction or refund changes its balance) and shows a toast.
 */
export function useMyWeatherPenalties(
	options: { enabled?: boolean; connection?: RealtimeConnection; service?: Service } = {}
) {
	const { connection, service = weatherPenaltiesService } = options;
	const userId = getStoredAuthUser()?.id ?? "";
	const enabled = (options.enabled ?? true) && Boolean(userId);
	const client = useQueryClient();
	const key = queryKeys.weather.myPenalties(userId);
	const query = useQuery({
		queryKey: key,
		queryFn: service.listMine,
		enabled,
		refetchInterval: WEATHER_PENALTY_POLL_MS,
	});
	useRealtimeConnection(enabled, connection);
	useRealtimeEvent<{ tripTitle?: string }>(
		"host.weather_penalty.created",
		(event) => {
			void client.invalidateQueries({ queryKey: key });
			toast.warning(
				`Bạn bị phạt vì không quyết định thời tiết đúng hạn${
					event?.tripTitle ? ` cho Trip "${event.tripTitle}"` : ""
				}. Xem chi tiết trong Ví Host.`,
				"Phạt thời tiết"
			);
		},
		enabled,
		connection
	);
	return query;
}

export function useRequestWeatherPenaltyWaiver(service: Service = weatherPenaltiesService) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ penaltyId, input }: { penaltyId: string; input: WaiverRequestInput }) =>
			service.requestWaiver(penaltyId, input),
		onSuccess: () => client.invalidateQueries({ queryKey: ["weather", "penalties"] }),
	});
}

export function useUploadWeatherPenaltyEvidence(service: Service = weatherPenaltiesService) {
	return useMutation({ mutationFn: (file: File) => service.uploadEvidence(file) });
}

/** Admin list by filter; a `weather_penalty.waiver_requested` event reloads it. */
export function useAdminWeatherPenalties(
	filter: AdminPenaltyFilter,
	options: { connection?: RealtimeConnection; service?: Service } = {}
) {
	const { connection, service = weatherPenaltiesService } = options;
	const client = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.weather.adminPenalties(filter),
		queryFn: () => service.listForAdmin(filter),
		refetchInterval: WEATHER_PENALTY_POLL_MS,
	});
	useRealtimeConnection(true, connection);
	useRealtimeEvent(
		"weather_penalty.waiver_requested",
		() => void client.invalidateQueries({ queryKey: ["weather", "penalties", "admin"] }),
		true,
		connection
	);
	return query;
}

export function useReviewWeatherPenaltyWaiver(service: Service = weatherPenaltiesService) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ penaltyId, input }: { penaltyId: string; input: WaiverReviewInput }) =>
			service.reviewWaiver(penaltyId, input),
		onSuccess: () => client.invalidateQueries({ queryKey: ["weather", "penalties"] }),
	});
}
