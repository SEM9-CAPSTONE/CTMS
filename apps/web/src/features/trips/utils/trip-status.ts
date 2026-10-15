import type { TripStatus } from "../types";

export function getTripDisplayStatus(
	trip: { status: TripStatus; startsAt: string; endsAt: string },
	now: number
): TripStatus {
	if (trip.status !== "published" && trip.status !== "ongoing") return trip.status;
	if (Date.parse(trip.endsAt) <= now) return "completed";
	if (Date.parse(trip.startsAt) <= now) return "ongoing";
	return trip.status;
}
