import type { CreateTripInput, Trip, TripWaypoint } from "../types";
export function pendingTripPreview(trip: Trip, payload: CreateTripInput): Trip {
	const endpoints = payload.waypoints
		.filter((w) => w.type === "start" || w.type === "finish")
		.map(
			(w, index): TripWaypoint => ({
				...w,
				id: trip.waypoints.find((old) => old.type === w.type)?.id ?? crypto.randomUUID(),
				tripId: trip.id,
				checkpointId: w.checkpointId ?? null,
				dayNumber: 1,
				sequenceOrder: index + 1,
				plannedAt: w.plannedAt,
				durationMinutes: null,
				metadata: w.metadata ?? null,
			})
		);
	const middle =
		payload.routeId === trip.routeId
			? trip.waypoints.filter((w) => w.type !== "start" && w.type !== "finish")
			: [];
	const waypoints = [
		...endpoints.filter((w) => w.type === "start"),
		...middle,
		...endpoints.filter((w) => w.type === "finish"),
	].map((w, index) => ({ ...w, sequenceOrder: index + 1 }));
	return {
		...trip,
		...payload,
		description: payload.description ?? null,
		meetingAt: payload.meetingAt ?? null,
		coverImageUrl: trip.coverImageUrl,
		waypoints,
	};
}
