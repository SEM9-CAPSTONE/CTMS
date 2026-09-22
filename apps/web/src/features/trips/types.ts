import type { GeoJsonPoint } from "../trekking-routes/types";

export const TRIP_TYPES = ["day_trip", "overnight"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export type TripStatus =
	| "draft"
	| "pending_approval"
	| "published"
	| "ongoing"
	| "completed"
	| "cancelled";

export const TRIP_WAYPOINT_TYPES = [
	"start",
	"checkpoint",
	"rest",
	"meal",
	"activity",
	"overnight",
	"finish",
] as const;
export type TripWaypointType = (typeof TRIP_WAYPOINT_TYPES)[number];

export interface CreateTripWaypointInput {
	checkpointId?: string;
	type: TripWaypointType;
	name: string;
	location: GeoJsonPoint;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt?: string;
	durationMinutes?: number;
}

export interface CreateTripInput {
	routeId: string;
	title: string;
	description?: string;
	coverImageUrl?: string;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt?: string;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	pricePerPerson: number;
	waypoints: CreateTripWaypointInput[];
}

export interface TripWaypoint {
	id: string;
	tripId: string;
	checkpointId: string | null;
	type: TripWaypointType;
	name: string;
	location: GeoJsonPoint;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: string | null;
	durationMinutes: number | null;
	metadata: Record<string, unknown> | null;
}

export type ReviewTripAction = "approve" | "decline";

export interface ReviewTripInput {
	action: ReviewTripAction;
	reason?: string;
}

export interface Trip {
	id: string;
	hostId: string;
	routeId: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	tripType: TripType;
	durationNights: number;
	startsAt: string;
	endsAt: string;
	meetingPoint: GeoJsonPoint;
	meetingAt: string | null;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	pricePerPerson: number;
	cancellationPolicy: Record<string, unknown> | null;
	status: TripStatus;
	createdAt: string;
	updatedAt: string;
	waypoints: TripWaypoint[];
}
