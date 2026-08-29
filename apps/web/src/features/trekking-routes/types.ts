export const ROUTE_DIFFICULTIES = ["easy", "moderate", "hard", "expert"] as const;
export type RouteDifficulty = (typeof ROUTE_DIFFICULTIES)[number];

export type RouteStatus = "draft" | "pending_approval" | "active" | "closed";
export type RouteLifecycleAction = "close" | "reopen";
export type Position = [number, number];

export const CHECKPOINT_TYPES = [
	"start",
	"rest",
	"water",
	"dangerous",
	"emergency_shelter",
	"finish",
] as const;
export type CheckpointType = (typeof CHECKPOINT_TYPES)[number];

export interface GeoJsonPoint {
	type: "Point";
	coordinates: Position;
}

export interface GeoJsonLineString {
	type: "LineString";
	coordinates: Position[];
}

export interface CreateTrekkingRouteInput {
	campsiteId: string;
	name: string;
	description?: string;
	geometry: GeoJsonLineString;
	difficulty: RouteDifficulty;
	expectedDurationMinutes: number;
}

export interface CreatedTrekkingRoute extends Omit<CreateTrekkingRouteInput, "description"> {
	id: string;
	description: string | null;
	lengthMeters: number;
	status: RouteStatus;
	createdAt: string;
	updatedAt: string;
}

export interface RouteStatusReasonInput {
	reason: string;
}

export interface CreateCheckpointInput {
	name: string;
	location: GeoJsonPoint;
	radiusMeters: number;
	type: CheckpointType;
	expectedArrivalOffset: number;
	instructions: string;
	nearbyWaterOrShelter: boolean;
}

export interface RouteCheckpoint extends CreateCheckpointInput {
	id: string;
	routeId: string;
	routePosition: number;
	createdAt: string;
	updatedAt: string;
}

export type ReviewTrekkingRouteAction = "approve" | "decline" | "non_operable";

export interface ReviewTrekkingRouteInput {
	action: ReviewTrekkingRouteAction;
	reason?: string;
}

export interface AdminTrekkingRouteReview extends CreatedTrekkingRoute {
	campsiteName: string;
	checkpoints: RouteCheckpoint[];
}

export type WeatherSnapshotStatus = "success" | "failed";

export interface WeatherSnapshot {
	id: string;
	routeId: string;
	status: WeatherSnapshotStatus;
	observedAt: string | null;
	rainfallMm: number | null;
	windKph: number | null;
	temperatureC: number | null;
	visibilityM: number | null;
	thunderstorm: boolean | null;
	errorMessage: string | null;
	createdAt: string;
}
