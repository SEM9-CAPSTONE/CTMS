import type {
	GeoJsonLineString,
	GeoJsonPoint,
	GeoJsonPolygon,
	Position,
} from "../trekking-routes/types";

export type SafetySeverity = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "UNKNOWN";
export type SafetySourceType =
	| "OFFICIAL_CURRENT"
	| "BASE_HISTORICAL"
	| "HOST_DEFINED"
	| "FIELD_OBSERVATION"
	| "RESOURCE";
export type SafetyLifecycle =
	| "ACTIVE"
	| "STALE"
	| "EXPIRED"
	| "RESOLVED"
	| "HISTORICAL"
	| "SCHEDULED"
	| "UNKNOWN";
export interface SafetyFeature {
	type: "Feature";
	id: string;
	geometry:
		| GeoJsonPoint
		| GeoJsonLineString
		| GeoJsonPolygon
		| { type: "MultiPolygon"; coordinates: Position[][][] };
	properties: {
		sourceType: SafetySourceType;
		source: string;
		sourceReference: string;
		hazardType: string;
		severity: SafetySeverity;
		geometryRole: string;
		description: string;
		observedAt: string | null;
		issuedAt: string | null;
		fetchedAt: string | null;
		validFrom: string | null;
		validUntil: string | null;
		updatedAt: string;
		lifecycleStatus: SafetyLifecycle;
		verificationStatus: "SOURCE_PROVIDED" | "UNVERIFIED" | "VERIFIED";
		accuracyMeters: number | null;
		distanceMeters: number;
		intersects: boolean;
		radiusMeters: number | null;
	};
}
export interface SafetyCollection {
	type: "FeatureCollection";
	features: SafetyFeature[];
}
export interface RouteSafetyResult {
	sources?: LiveSafetySource[];
	liveSource?: {
		source: "NCHMF";
		status: "LIVE" | "EMPTY" | "PARTIAL" | "UNAVAILABLE" | "DISABLED";
		checkedAt: string;
		dataTime: string | null;
		validUntil: string | null;
	};
	riskLevel: SafetySeverity;
	summary: {
		activeWarnings: number;
		nearbyIncidents: number;
		hostDefinedDangerZones: number;
		historicalFeatures: number;
	};
	features: SafetyCollection;
	analyzedAt: string;
	dataVersion: string;
	truncated: boolean;
	coverage: "PARTIAL";
	proximityMeters: number;
}

export type SafetyProvider = "NCHMF" | "VNDMS" | "OSM";
export interface LiveSafetySource {
	source: SafetyProvider;
	status: "LOADING" | "LIVE" | "EMPTY" | "PARTIAL" | "UNAVAILABLE" | "DISABLED";
	checkedAt: string;
	dataTime: string | null;
	validUntil: string | null;
}
