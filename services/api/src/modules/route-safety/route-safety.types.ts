import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";

export type SafetyGeometry =
	| { type: "Point"; coordinates: [number, number] }
	| GeoLineString
	| { type: "Polygon"; coordinates: Array<Array<[number, number]>> }
	| { type: "MultiPolygon"; coordinates: Array<Array<Array<[number, number]>>> };
export type SafetySourceType =
	| "OFFICIAL_CURRENT"
	| "BASE_HISTORICAL"
	| "RESOURCE"
	| "HOST_DEFINED"
	| "FIELD_OBSERVATION";
export type SafetySeverity = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "UNKNOWN";
export type SafetyLifecycle =
	| "ACTIVE"
	| "STALE"
	| "EXPIRED"
	| "RESOLVED"
	| "HISTORICAL"
	| "SCHEDULED"
	| "UNKNOWN";
export type SafetyVerification = "SOURCE_PROVIDED" | "UNVERIFIED" | "VERIFIED";

export interface SafetyCandidate {
	id: string;
	sourceType: SafetySourceType;
	source: string;
	sourceReference: string;
	hazardType: string;
	severity: SafetySeverity;
	geometry: SafetyGeometry;
	geometryRole: string;
	description: string;
	observedAt: string | null;
	issuedAt: string | null;
	fetchedAt: string | null;
	validFrom: string | null;
	validUntil: string | null;
	updatedAt: string;
	lifecycleStatus: SafetyLifecycle;
	verificationStatus: SafetyVerification;
	accuracyMeters: number | null;
	distanceMeters: number;
	intersects: boolean;
	radiusMeters: number | null;
}

export interface SafetyFeature {
	type: "Feature";
	id: string;
	geometry: SafetyGeometry;
	properties: Omit<SafetyCandidate, "geometry" | "id">;
}

export interface RouteSafetyResult {
	liveSource?: import("./nchmf-safety.types").LiveSafetySource;
	sources: import("./live-safety.types").LiveSafetySource[];
	riskLevel: SafetySeverity;
	summary: {
		activeWarnings: number;
		nearbyIncidents: number;
		hostDefinedDangerZones: number;
		historicalFeatures: number;
	};
	features: { type: "FeatureCollection"; features: SafetyFeature[] };
	analyzedAt: string;
	dataVersion: string;
	truncated: boolean;
	coverage: "PARTIAL";
	proximityMeters: number;
}

export interface ExternalSafetyInput {
	externalId: string;
	sourceType: "OFFICIAL_CURRENT" | "BASE_HISTORICAL" | "RESOURCE";
	sourceReference: string;
	hazardType: string;
	severity: SafetySeverity;
	geometry: SafetyGeometry;
	geometryRole: string;
	description: string;
	observedAt: string | null;
	issuedAt: string | null;
	validFrom: string | null;
	validUntil: string | null;
	lifecycleStatus: "ACTIVE" | "RESOLVED";
	verificationStatus: "SOURCE_PROVIDED" | "UNVERIFIED" | "VERIFIED";
	accuracyMeters: number | null;
}
