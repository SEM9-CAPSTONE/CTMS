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

export type TrekkingRouteDifficulty = "easy" | "moderate" | "hard" | "expert";

export type RiskLevel = "green" | "yellow" | "red";

export interface SearchTripsQuery {
	search?: string;
	tripType?: TripType;
	difficulty?: TrekkingRouteDifficulty;
	startDate?: string;
	endDate?: string;
	minPrice?: number;
	maxPrice?: number;
	routeId?: string;
	province?: string;
	city?: string;
	page?: number;
	limit?: number;
}

export interface TripSummary {
	id: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
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
	remainingSeats: number | null;
	pricePerPerson: number;
	status: TripStatus;
	difficulty: TrekkingRouteDifficulty | null;
	weatherRiskLevel: RiskLevel | null;
	isBookable: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TripsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedTrips {
	items: TripSummary[];
	pagination: TripsPagination;
}

export interface TripHost {
	id: string;
	fullName?: string | null;
	email?: string | null;
	phone?: string | null;
	bio?: string | null;
}

export interface TripDetails {
	id: string;
	hostId: string;
	host?: TripHost | null;
	routeId?: string;
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
	remainingSeats: number | null;
	pricePerPerson: number;
	cancellationPolicy: Record<string, unknown> | null;
	status: TripStatus;
	difficulty?: TrekkingRouteDifficulty | null;
	weatherRiskLevel?: RiskLevel | null;
	isBookable: boolean;
	createdAt: string;
	updatedAt: string;
	waypoints: TripWaypoint[];
}

export type BookingBlockedReason =
	| "SOLD_OUT"
	| "DEADLINE_PASSED"
	| "TRIP_NOT_PUBLISHED"
	| "CONFLICT";

export interface BookTripInput {
	tripId: string;
	numPeople: number;
}

export interface BookTripResponse {
	id: string;
	tripId: string;
	userId: string;
	numPeople: number;
	status: "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
	paymentStatus: "not_required" | "unpaid" | "paid";
	holdExpiresAt: string | null;
	tripStartsAtSnapshot: string;
	tripEndsAtSnapshot: string;
	basePrice: string;
	cancellationPolicySnapshot: Record<string, unknown> | null;
	createdAt: string;
}
