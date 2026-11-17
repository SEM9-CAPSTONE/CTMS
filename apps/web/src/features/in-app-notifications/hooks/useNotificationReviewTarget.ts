import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripsService } from "../../trips/services/trips.service";
import type { AdminTripReview } from "../../trips/types";

export function useNotificationReviewTarget(tripId: string | null) {
	const actor = getStoredAuthUser()?.id ?? "";
	const query = useQuery({
		queryKey: queryKeys.inAppNotifications.reviewTarget(actor, tripId ?? ""),
		queryFn: () => tripsService.getById(tripId ?? ""),
		enabled: Boolean(tripId && actor),
		retry: false,
		gcTime: 0,
	});
	const trip = query.data;
	// Only a current pending Trip is adapted to the existing review form. No historical outcome is inferred.
	const review: AdminTripReview | null =
		trip?.status === "pending_approval" && trip.routeId
			? { ...trip, routeId: trip.routeId, reviewOutcome: "pending", reviewedAt: null }
			: null;
	return { query, review };
}
