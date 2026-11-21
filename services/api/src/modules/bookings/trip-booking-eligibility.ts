import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";

/**
 * The Trip facts the booking rules read. Both the locked booking transaction and read-only
 * consumers (trip recommendations) evaluate the same rules over these facts, so a Trip shown as
 * eligible is judged exactly like a booking attempt at that moment; the booking transaction still
 * re-evaluates under its row locks.
 */
export interface TripBookingFacts {
	status: TripStatus;
	routeStatus: TrekkingRouteStatus | null;
	bookingDeadline: Date;
	startsAt: Date;
	capacityMax: number | null;
	seatsTaken: number;
	weatherPausedAt?: Date | null;
}

export type TripBookingIneligibility =
	| "not_published"
	| "weather_paused"
	| "booking_closed"
	| "already_started"
	| "route_inactive"
	| "invalid_party_size"
	| "insufficient_seats";

/**
 * Returns the first rule the Trip fails for `numPeople`, or null when it can be booked (weather is
 * checked separately by RouteRegistrationRiskService). The order matches the error precedence of
 * the booking endpoint. A deadline or departure equal to `now` counts as passed.
 */
export function evaluateTripBookingEligibility(
	trip: TripBookingFacts,
	numPeople: number,
	now: Date = new Date()
): TripBookingIneligibility | null {
	if (trip.status !== TripStatus.PUBLISHED) return "not_published";
	if (trip.weatherPausedAt) return "weather_paused";
	if (trip.bookingDeadline.getTime() <= now.getTime()) return "booking_closed";
	if (trip.startsAt.getTime() <= now.getTime()) return "already_started";
	if (trip.routeStatus !== TrekkingRouteStatus.ACTIVE) return "route_inactive";
	if (!Number.isSafeInteger(numPeople) || numPeople < 1) return "invalid_party_size";
	if (trip.capacityMax !== null && trip.seatsTaken + numPeople > trip.capacityMax) {
		return "insufficient_seats";
	}
	return null;
}
