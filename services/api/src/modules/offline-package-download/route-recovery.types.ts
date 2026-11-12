import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import type { TripStatus } from "../trips/entities/trip.entity";

export enum RecoveryStatus {
	AVAILABLE = "AVAILABLE",
	UNAVAILABLE = "UNAVAILABLE",
	STALE = "STALE",
	MISMATCH = "MISMATCH",
}
export enum RecoveryReason {
	TRIP_NOT_NAVIGABLE = "TRIP_NOT_NAVIGABLE",
	PACKAGE_NOT_FOUND = "PACKAGE_NOT_FOUND",
	PACKAGE_ID_VERSION_MISMATCH = "PACKAGE_ID_VERSION_MISMATCH",
	ROUTE_ID_MISMATCH = "ROUTE_ID_MISMATCH",
	ARTIFACT_UNAVAILABLE = "ARTIFACT_UNAVAILABLE",
	ROUTE_UNAVAILABLE = "ROUTE_UNAVAILABLE",
	ROUTE_VERSION_CHANGED = "ROUTE_VERSION_CHANGED",
	NEWER_PACKAGE_AVAILABLE = "NEWER_PACKAGE_AVAILABLE",
}
export interface RecoveryPackageIdentity {
	id: string;
	version: number;
	sha256: string;
	generatedAt: string;
	routeId: string;
	routeFingerprint: string;
}
export interface RouteRecoveryContext {
	status: RecoveryStatus;
	reason: RecoveryReason | null;
	tripId: string;
	tripStatus: TripStatus;
	observedAt: string;
	requested: { packageId: string; packageVersion: number };
	package: RecoveryPackageIdentity | null;
	current: {
		routeId: string | null;
		routeFingerprint: string | null;
		latestPackageVersion: number | null;
	};
	geometry: GeoLineString | null;
	conventions: {
		coordinateSystem: "EPSG:4326";
		coordinateOrder: "longitude,latitude";
		distanceUnit: "metre";
		bearingUnit: "degree";
		bearingReference: "true-north-clockwise";
		bearingRange: "[0,360)";
	};
}
