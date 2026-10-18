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
/** Types a host can pick for a route location; start/finish/rest are configured on trip waypoints. */
export const ROUTE_CHECKPOINT_TYPES = ["water", "dangerous", "emergency_shelter"] as const;
export type RouteCheckpointType = (typeof ROUTE_CHECKPOINT_TYPES)[number];

export interface GeoJsonPoint {
	type: "Point";
	coordinates: Position;
}

export interface GeoJsonLineString {
	type: "LineString";
	coordinates: Position[];
}

export interface GeoJsonPolygon {
	type: "Polygon";
	coordinates: Position[][];
}

export const ROUTE_DANGER_ZONE_SEVERITIES = ["low", "medium", "high"] as const;
export type RouteDangerZoneSeverity = (typeof ROUTE_DANGER_ZONE_SEVERITIES)[number];
export type RouteDangerZoneGeometry = GeoJsonPoint | GeoJsonPolygon;
export type RouteMapMode = "checkpoint" | "hazard-point" | "hazard-polygon";

interface CreateRouteDangerZoneBase {
	description: string;
	severity: RouteDangerZoneSeverity;
}

export type CreateRouteDangerZoneInput =
	| (CreateRouteDangerZoneBase & {
			geometry: GeoJsonPoint;
			radiusMeters: number;
	  })
	| (CreateRouteDangerZoneBase & {
			geometry: GeoJsonPolygon;
			radiusMeters?: never;
	  });

export interface RouteDangerZone extends CreateRouteDangerZoneBase {
	id: string;
	routeId: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateTrekkingRouteInput {
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

export type UpdateCheckpointInput = CreateCheckpointInput;

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
	checkpoints: RouteCheckpoint[];
	dangerZones: RouteDangerZone[];
}
