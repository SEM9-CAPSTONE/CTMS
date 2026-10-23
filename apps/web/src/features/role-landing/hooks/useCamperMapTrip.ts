import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { bookingListService } from "../../booking-list/services/booking-list.service";
import { tripsService } from "../../trips/services/trips.service";

const CAMPER_MAP_STALE_TIME = 30_000;

export function useCamperMapTrip(userId: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.bookings.camperMap(userId),
		enabled: enabled && Boolean(userId) && Boolean(localStorage.getItem("accessToken")),
		queryFn: async () => {
			const bookings = await bookingListService.getMyBookings();
			const now = Date.now();
			const candidates = bookings
				.filter(
					(booking) =>
						booking.status === "confirmed" &&
						booking.tripEndsAtSnapshot &&
						Date.parse(booking.tripEndsAtSnapshot) > now
				)
				.sort(
					(a, b) =>
						Date.parse(a.tripStartsAtSnapshot ?? a.createdAt) -
						Date.parse(b.tripStartsAtSnapshot ?? b.createdAt)
				);
			if (!candidates[0]) return null;
			const trip = await tripsService.getById(candidates[0].tripId);
			return trip.status === "published" || trip.status === "ongoing" ? trip : null;
		},
		staleTime: CAMPER_MAP_STALE_TIME,
	});
}
