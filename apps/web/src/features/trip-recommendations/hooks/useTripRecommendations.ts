import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HttpError, queryKeys } from "../../../core/api";
import { toast } from "../../../shared/components/Toast";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripRecommendationsService } from "../services/trip-recommendations.service";
import type { TripPreferences, TripPreferencesInput } from "../types";

const RECOMMENDATIONS_STALE_MS = 60_000;

/** Keys carry the signed-in user, so another account never reads this account's cache. */
function currentUserId(): string {
	return getStoredAuthUser()?.id ?? "";
}

export function useTripRecommendations(enabled = true) {
	const userId = currentUserId();
	return useQuery({
		queryKey: queryKeys.tripRecommendations.list(userId),
		queryFn: ({ signal }) => tripRecommendationsService.list(signal),
		enabled: enabled && Boolean(userId),
		staleTime: RECOMMENDATIONS_STALE_MS,
		// Every opening of the suggestions modal asks the server again for current availability.
		refetchOnMount: "always",
		retry: false,
	});
}

/** Only for a Trip opened from the suggestions; re-read each visit so seats and fitness are current. */
export function useTripRecommendationExplanation(tripId: string, enabled = true) {
	const userId = currentUserId();
	return useQuery({
		queryKey: queryKeys.tripRecommendations.explanation(userId, tripId),
		queryFn: ({ signal }) => tripRecommendationsService.getExplanation(tripId, signal),
		enabled: enabled && Boolean(userId),
		refetchOnMount: "always",
		retry: false,
	});
}

export function useTripPreferences(enabled: boolean) {
	const userId = currentUserId();
	return useQuery({
		queryKey: queryKeys.tripRecommendations.preferences(userId),
		queryFn: ({ signal }) => tripRecommendationsService.getPreferences(signal),
		enabled: enabled && Boolean(userId),
		retry: false,
	});
}

export function preferencesErrorMessage(error: unknown): string {
	if (error instanceof HttpError && error.status === 422) {
		return "Sở thích chưa hợp lệ. Vui lòng kiểm tra lại khoảng giá.";
	}
	if (error instanceof HttpError) return "Không thể lưu sở thích. Vui lòng thử lại.";
	return "Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền.";
}

export function useSaveTripPreferences(onSaved?: () => void) {
	const client = useQueryClient();
	const userId = currentUserId();
	return useMutation({
		mutationFn: (input: TripPreferencesInput) =>
			tripRecommendationsService.replacePreferences(input),
		onSuccess: async (saved: TripPreferences) => {
			client.setQueryData(queryKeys.tripRecommendations.preferences(userId), saved);
			toast.success("Đã lưu sở thích chuyến đi. Gợi ý đang được cập nhật.");
			onSaved?.();
			await client.invalidateQueries({ queryKey: queryKeys.tripRecommendations.list(userId) });
		},
		onError: (error) => toast.error(preferencesErrorMessage(error)),
	});
}
