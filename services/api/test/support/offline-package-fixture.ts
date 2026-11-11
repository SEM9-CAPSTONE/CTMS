import { ChunkSetStatus } from "../../src/modules/knowledge-chunks/knowledge-chunks.types";
import type {
	NormalizedPackageHazard,
	PackageCore,
	PackageSafetyInputs,
} from "../../src/modules/offline-packages/offline-packages.types";
import { canonical, digest } from "../../src/modules/offline-packages/package-policy";
import { DocumentStatus } from "../../src/modules/survival-documents/survival-documents.types";
import { CheckpointType } from "../../src/modules/trekking-routes/entities/checkpoint.entity";
import { WaypointType } from "../../src/modules/trips/entities/trip-waypoint.entity";
import { TripStatus, TripType } from "../../src/modules/trips/entities/trip.entity";
import { fictionalMetadata, fictionalRights } from "./survival-source-fixture";

// Fictional test-only approvals and source runs. Never bind this to the application module.
export function fictionalPackageCore(): PackageCore {
	return {
		tripId: "trip",
		routeId: "route",
		status: TripStatus.PUBLISHED,
		tripType: TripType.DAY_TRIP,
		startsAt: "2026-12-01T01:00:00.000Z",
		endsAt: "2026-12-01T10:00:00.000Z",
		geometry: {
			type: "LineString",
			coordinates: [
				[108, 16],
				[108.01, 16.01],
			],
		},
		checkpoints: [
			{
				id: "checkpoint",
				routeId: "route",
				name: "Fictional checkpoint",
				type: CheckpointType.REST,
				location: { type: "Point", coordinates: [108, 16] },
				radiusMeters: 30,
				expectedArrivalOffset: 10,
				instructions: "Fictional instructions",
				routePosition: 0.5,
			},
		],
		waypoints: [WaypointType.START, WaypointType.FINISH].map((type, index) => ({
			id: `waypoint-${index}`,
			checkpointId: null,
			type,
			name: "Fictional waypoint",
			location: { type: "Point", coordinates: [108 + index * 0.01, 16 + index * 0.01] },
			dayNumber: 1,
			sequenceOrder: index,
			plannedAt: index ? "2026-12-01T10:00:00.000Z" : "2026-12-01T01:00:00.000Z",
			durationMinutes: 0,
		})),
	};
}
export function fictionalPackageSafety(): PackageSafetyInputs {
	const checksum = "a".repeat(64);
	return {
		revision: "fictional-revision-1",
		blockers: [],
		conditionEvidence: [],
		hazards: [],
		policy: {
			version: "fictional-policy-1",
			approvalId: "fictional-policy-approval",
			requiredGovernmentSources: ["fictional-provider"],
			baselineTopics: ["trekking"],
			conditionTopics: [],
			hazardTopics: [],
			requiredConditions: [],
			requireCheckpoints: true,
			requiredWaypointTypes: [WaypointType.START, WaypointType.FINISH],
		},
		feeds: [
			{
				sourceId: "fictional-provider",
				sourceType: "GOVERNMENT",
				sourceVersion: "fictional-run-1",
				sourceReference: "https://example.org/fictional-run",
				status: "EMPTY",
				checkedAt: "2026-01-01T00:00:00.000Z",
				validUntil: "2099-01-01T00:00:00.000Z",
			},
		],
		guidance: [
			{
				id: "fictional-unit",
				topic: "trekking",
				applicableConditions: [],
				excludedConditions: [],
				approval: {
					id: "fictional-approval",
					version: "1",
					approvedBy: "private-admin",
					approvedAt: "2026-01-01T00:00:00.000Z",
					taxonomyVersion: "fictional-taxonomy-1",
					status: "APPROVED",
				},
				source: {
					id: "fictional-document-version",
					documentId: "fictional-document",
					versionNumber: 1,
					revision: 1,
					status: DocumentStatus.PUBLISHED,
					metadata: fictionalMetadata,
					rights: { ...fictionalRights, offlineRedistributionAllowed: true },
					originalVersionId: null,
					fileRef: "private-pdf",
					originalFilename: "fictional.pdf",
					checksum,
					size: 100,
					contentType: "application/pdf",
					createdBy: "private-admin",
					createdAt: "2026-01-01T00:00:00.000Z",
					reviewedBy: "private-admin",
					reviewedAt: "2026-01-01T00:00:00.000Z",
					publishedBy: "private-admin",
					publishedAt: "2026-01-01T00:00:00.000Z",
					reason: null,
				},
				currentPublishedVersionId: "fictional-document-version",
				chunkSet: {
					id: "fictional-chunk-set",
					documentVersionId: "fictional-document-version",
					sourceChecksum: checksum,
					status: ChunkSetStatus.READY,
				},
				chunkIds: ["fictional-chunk"],
				pageRefs: [{ chunkId: "fictional-chunk", page: 1, itemRef: "#/texts/1" }],
				content: "Fictional complete guidance; not safety advice.",
				complete: true,
				containsPersonalData: false,
			},
		],
	};
}

export function fictionalPackageSafetyWithHazards(core: PackageCore): PackageSafetyInputs {
	const safety = fictionalPackageSafety();
	safety.feeds[0].status = "AVAILABLE";
	const government: NormalizedPackageHazard = {
		id: "fictional-government-hazard",
		sourceType: "GOVERNMENT",
		sourceId: safety.feeds[0].sourceId,
		sourceVersion: safety.feeds[0].sourceVersion,
		sourceReference: "https://example.org/e2e-hazard",
		geometry: { type: "Point", coordinates: [108, 16] },
		geometryRole: "OBSERVED_POINT",
		accuracyMeters: 10,
		hazardType: "fictional-hazard",
		severity: "HIGH",
		issuedAt: "2026-01-01T00:00:00Z",
		observedAt: null,
		validFrom: "2026-01-01T00:00:00Z",
		validUntil: "2099-01-01T00:00:00Z",
		lifecycle: "ACTIVE",
		verification: "SOURCE_PROVIDED",
		match: {
			routeFingerprint: digest(canonical(core.geometry)),
			intersects: true,
			distanceMeters: 0,
			proximityMeters: 100,
		},
		containsPersonalData: false,
	};
	safety.feeds.push({
		...safety.feeds[0],
		sourceType: "FIELD_VERIFIED",
		sourceId: "fictional-field-source",
	});
	safety.hazards = [
		government,
		{
			...government,
			id: "fictional-field-hazard",
			sourceType: "FIELD_VERIFIED",
			sourceId: "fictional-field-source",
			verification: "VERIFIED",
			hostDecision: {
				id: "fictional-decision",
				reportId: "PRIVATE_REPORT_ID",
				version: "1",
				status: "APPROVED",
				verifiedByHostId: "PRIVATE_HOST_ID",
				authorized: true,
				verifiedAt: "2026-01-01T00:00:00Z",
				evidenceRef: "PRIVATE_EVIDENCE_REFERENCE",
			},
		},
	];
	return safety;
}
