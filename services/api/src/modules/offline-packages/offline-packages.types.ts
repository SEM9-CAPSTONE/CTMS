import type { EntityManager } from "typeorm";
import type { SafetyGeometry } from "../route-safety/route-safety.types";
import type { SourceVersion } from "../survival-documents/survival-documents.types";
import type { CheckpointType } from "../trekking-routes/entities/checkpoint.entity";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import type { WaypointType } from "../trips/entities/trip-waypoint.entity";
import type { GeoPoint, TripStatus, TripType } from "../trips/entities/trip.entity";

export const PACKAGE_SCHEMA_VERSION = 1;
export const PACKAGE_POLICY_VERSION = "ctms052-v2";
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export const MAX_ITEMS = 10_000;
export const MAX_ATTEMPTS = 3;
export const LEASE_SECONDS = 120;
export const POLL_MS = 5000;
export enum PackageJobStatus {
	PENDING = "PENDING",
	GENERATING = "GENERATING",
	READY = "READY",
	BLOCKED = "BLOCKED",
	RETRYABLE_FAILED = "RETRYABLE_FAILED",
	FAILED = "FAILED",
}
export enum PackageReason {
	TRIP_NOT_PUBLISHED = "TRIP_NOT_PUBLISHED",
	CORE_INCOMPLETE = "CORE_INCOMPLETE",
	HAZARD_FEED_UNAVAILABLE = "HAZARD_FEED_UNAVAILABLE",
	HAZARD_FEED_STALE = "HAZARD_FEED_STALE",
	HAZARD_FEED_INVALID = "HAZARD_FEED_INVALID",
	GUIDANCE_APPROVAL_UNAVAILABLE = "GUIDANCE_APPROVAL_UNAVAILABLE",
	GUIDANCE_POLICY_UNAVAILABLE = "GUIDANCE_POLICY_UNAVAILABLE",
	GUIDANCE_COVERAGE_INCOMPLETE = "GUIDANCE_COVERAGE_INCOMPLETE",
	CONTEXT_UNKNOWN = "CONTEXT_UNKNOWN",
	PERSONAL_DATA_FORBIDDEN = "PERSONAL_DATA_FORBIDDEN",
	SOURCE_CHANGED = "SOURCE_CHANGED",
	VERSION_CONFLICT = "VERSION_CONFLICT",
	LEASE_LOST = "LEASE_LOST",
	ARTIFACT_INVALID = "ARTIFACT_INVALID",
	PACKAGE_TOO_LARGE = "PACKAGE_TOO_LARGE",
	GENERATION_FAILED = "GENERATION_FAILED",
}
export class PackageFailure extends Error {
	constructor(
		readonly reasons: PackageReason[],
		readonly retryable = false
	) {
		super(reasons.join(","));
	}
}
export interface PackageCheckpoint {
	id: string;
	routeId: string;
	name: string;
	type: CheckpointType;
	location: GeoPoint;
	radiusMeters: number;
	expectedArrivalOffset: number;
	instructions: string;
	routePosition: number;
}
export interface PackageWaypoint {
	id: string;
	checkpointId: string | null;
	type: WaypointType;
	name: string;
	location: GeoPoint;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: string | null;
	durationMinutes: number | null;
}
export interface PackageCore {
	tripId: string;
	status: TripStatus;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	routeId: string;
	geometry: GeoLineString;
	checkpoints: PackageCheckpoint[];
	waypoints: PackageWaypoint[];
}
export type ConditionState = "CONFIRMED" | "NOT_APPLICABLE" | "UNKNOWN";
export interface ContextCondition {
	code: string;
	state: ConditionState;
	evidenceRef: string | null;
}
export interface TripSafetyContext {
	tripId: string;
	routeId: string;
	routeFingerprint: string;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	conditions: ContextCondition[];
	policyVersion: string;
}
export interface HazardFeed {
	sourceId: string;
	sourceType: "GOVERNMENT" | "FIELD_VERIFIED";
	sourceVersion: string;
	sourceReference: string;
	status: "AVAILABLE" | "EMPTY" | "UNAVAILABLE" | "PARTIAL" | "STALE";
	checkedAt: string;
	validUntil: string | null;
}
export interface NormalizedPackageHazard {
	id: string;
	sourceType: "GOVERNMENT" | "FIELD_VERIFIED" | "HOST_DEFINED" | "FIELD_OBSERVATION";
	sourceId: string;
	sourceVersion: string;
	sourceReference: string;
	geometry: SafetyGeometry;
	geometryRole: string;
	accuracyMeters: number | null;
	hazardType: string;
	severity: string;
	issuedAt: string | null;
	observedAt: string | null;
	validFrom: string;
	validUntil: string;
	lifecycle: "ACTIVE" | "EXPIRED" | "RESOLVED" | "REVOKED";
	verification: "SOURCE_PROVIDED" | "VERIFIED" | "UNVERIFIED" | "REJECTED" | "REVOKED";
	// Supplied by upstream PostGIS matching, never inferred from a bounding box here.
	match: {
		routeFingerprint: string;
		intersects: boolean;
		distanceMeters: number;
		proximityMeters: number;
	};
	hostDecision?: {
		reportId: string;
		id: string;
		version: string;
		status: "APPROVED" | "REJECTED" | "REVOKED";
		verifiedByHostId: string;
		authorized: boolean;
		verifiedAt: string;
		evidenceRef: string;
	};
	containsPersonalData: boolean;
}
export interface ApprovedGuidanceUnit {
	id: string;
	topic: string;
	applicableConditions: string[];
	excludedConditions: string[];
	approval: {
		id: string;
		version: string;
		approvedBy: string;
		approvedAt: string;
		taxonomyVersion: string;
		status: "APPROVED" | "REVOKED";
	};
	source: SourceVersion;
	currentPublishedVersionId: string;
	currentChunkSetId: string;
	chunkSet: { id: string; documentVersionId: string; sourceChecksum: string; status: string };
	chunkIds: string[];
	pageRefs: { chunkId: string; page: number; itemRef: string }[];
	content: string;
	complete: boolean;
	containsPersonalData: boolean;
}
export interface ApprovedPackagePolicy {
	version: string;
	approvalId: string;
	requiredGovernmentSources: string[];
	baselineTopics: string[];
	conditionTopics: { condition: string; topic: string }[];
	hazardTopics: { hazardType: string; topic: string }[];
	requiredConditions: string[];
	requireCheckpoints: boolean;
	requiredWaypointTypes: WaypointType[];
}
export interface PackageSafetyInputs {
	// Immutable revision covering source insert/delete, publication/rights/decision and policy changes.
	revision: string;
	policy: ApprovedPackagePolicy | null;
	conditionEvidence: ContextCondition[];
	feeds: HazardFeed[];
	hazards: NormalizedPackageHazard[];
	guidance: ApprovedGuidanceUnit[];
	blockers: PackageReason[];
}
/**
 * Upstream DB-only port. Resolve publication, set and chunks in the caller's snapshot.
 * With lock=true, lock source document rows in ID order before reading chunk rows,
 * and fence scope revisions and approval changes. Returned guidance is a value snapshot.
 * Durable approvals that still resolve live chunks must restrict deletion through FKs.
 */
export abstract class OfflineSafetySources {
	abstract read(
		manager: EntityManager,
		core: PackageCore,
		lock: boolean
	): Promise<PackageSafetyInputs>;
}
export interface PackageJob {
	id: string;
	trip_id: string;
	request_key: string;
	status: PackageJobStatus;
	attempts: number;
	lease_token: string | null;
	lease_until: Date | null;
	created_at: Date;
	generation_started_at: Date | null;
	reason_codes: PackageReason[];
	package_id: string | null;
}
export interface PackageManifest {
	schemaVersion: number;
	tripId: string;
	packageVersion: number;
	generatedAt: string;
	route: { routeId: string; fingerprint: string };
	snapshots: { core: string; sources: string };
	policy: { generator: string; coverage: string; approvalId: string };
	context: TripSafetyContext;
	hazardSourceSummary: (HazardFeed & {
		outcome: "ACTIVE_ALERTS" | "NO_ACTIVE_ALERT" | "UNKNOWN";
	})[];
	guidance: {
		unitId: string;
		documentVersionId: string;
		chunkSetId: string;
		chunkIds: string[];
		approvalVersion: string;
	}[];
	files: { path: string; sha256: string; sizeBytes: number }[];
}
export interface PackageMetadata {
	id: string;
	trip_id: string;
	package_version: number;
	generation_key: string;
	schema_version: number;
	manifest: PackageManifest;
	sha256: string;
	size_bytes: number;
	artifact_key: string;
	generated_at: Date;
}
export interface PackageSnapshot {
	core: PackageCore;
	safety: PackageSafetyInputs;
	coreFingerprint: string;
	sourceFingerprint: string;
	nextVersion: number;
}
/** CTMS-053 transport metadata; storage references and internal provenance stay private. */
export interface ReadyPackageMetadata {
	id: string;
	tripId: string;
	packageVersion: number;
	generationKey: string;
	schemaVersion: number;
	sha256: string;
	sizeBytes: number;
	generatedAt: string;
	contentType: "application/zip";
}
