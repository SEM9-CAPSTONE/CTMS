import { Injectable } from "@nestjs/common";
import { type UnzipFileInfo, type Zippable, unzipSync, zipSync } from "fflate";
import {
	type ApprovedGuidanceUnit,
	MAX_PACKAGE_BYTES,
	type NormalizedPackageHazard,
	PACKAGE_POLICY_VERSION,
	PACKAGE_SCHEMA_VERSION,
	PackageFailure,
	type PackageManifest,
	PackageReason,
	type PackageSnapshot,
	type TripSafetyContext,
} from "./offline-packages.types";
import { canonical, digest } from "./package-policy";

const PAYLOAD_PATHS = [
	"checkpoints.json",
	"guidance.json",
	"hazards.geojson",
	"route.geojson",
	"waypoints.json",
] as const;

@Injectable()
export class PackageArtifactBuilder {
	build(
		snapshot: PackageSnapshot,
		context: TripSafetyContext,
		hazards: NormalizedPackageHazard[],
		guidance: ApprovedGuidanceUnit[],
		generatedAt: string
	): { bytes: Buffer; manifest: PackageManifest; sha256: string } {
		const { core, safety } = snapshot;
		if (!safety.policy) throw new PackageFailure([PackageReason.GUIDANCE_POLICY_UNAVAILABLE]);
		// Explicit projections intentionally exclude arbitrary Trip/waypoint metadata and personal IDs.
		const payloads: Record<(typeof PAYLOAD_PATHS)[number], unknown> = {
			"route.geojson": {
				type: "Feature",
				geometry: { type: core.geometry.type, coordinates: core.geometry.coordinates },
				properties: { routeId: core.routeId, fingerprint: context.routeFingerprint },
			},
			"checkpoints.json": core.checkpoints.map((p) => ({
				id: p.id,
				routeId: p.routeId,
				name: p.name,
				type: p.type,
				location: { type: p.location.type, coordinates: p.location.coordinates },
				radiusMeters: p.radiusMeters,
				expectedArrivalOffset: p.expectedArrivalOffset,
				instructions: p.instructions,
				routePosition: p.routePosition,
			})),
			"waypoints.json": core.waypoints.map((p) => ({
				id: p.id,
				checkpointId: p.checkpointId,
				type: p.type,
				name: p.name,
				location: { type: p.location.type, coordinates: p.location.coordinates },
				dayNumber: p.dayNumber,
				sequenceOrder: p.sequenceOrder,
				plannedAt: p.plannedAt,
				durationMinutes: p.durationMinutes,
			})),
			"hazards.geojson": {
				type: "FeatureCollection",
				features: hazards.map((h) => ({
					type: "Feature",
					id: h.id,
					geometry: { type: h.geometry.type, coordinates: h.geometry.coordinates },
					properties: {
						sourceType: h.sourceType,
						sourceId: h.sourceId,
						sourceVersion: h.sourceVersion,
						sourceReference: h.sourceReference,
						geometryRole: h.geometryRole,
						accuracyMeters: h.accuracyMeters,
						hazardType: h.hazardType,
						severity: h.severity,
						issuedAt: h.issuedAt,
						observedAt: h.observedAt,
						validFrom: h.validFrom,
						validUntil: h.validUntil,
						verification: h.verification,
						decision: h.hostDecision
							? {
									id: h.hostDecision.id,
									version: h.hostDecision.version,
									evidenceFingerprint: digest(h.hostDecision.evidenceRef),
									verifiedAt: h.hostDecision.verifiedAt,
								}
							: null,
					},
				})),
			},
			"guidance.json": guidance.map((g) => ({
				unitId: g.id,
				topic: g.topic,
				content: g.content,
				locale: g.source.metadata.locale,
				applicableConditions: g.applicableConditions,
				excludedConditions: g.excludedConditions,
				documentId: g.source.documentId,
				documentVersionId: g.source.id,
				documentChecksum: g.source.checksum,
				chunkSetId: g.chunkSet.id,
				chunkIds: g.chunkIds,
				pageRefs: g.pageRefs.map((p) => ({ chunkId: p.chunkId, page: p.page, itemRef: p.itemRef })),
				sourceTitle: g.source.metadata.sourceTitle,
				attribution: g.source.metadata.attribution,
				sourceUrl: g.source.metadata.sourceUrl,
				licenseType: g.source.metadata.licenseType,
				licenseUrl: g.source.metadata.licenseUrl,
				approval: {
					id: g.approval.id,
					version: g.approval.version,
					taxonomyVersion: g.approval.taxonomyVersion,
					approvedAt: g.approval.approvedAt,
				},
			})),
		};
		const encoded = Object.fromEntries(
			PAYLOAD_PATHS.map((path) => [path, Buffer.from(canonical(payloads[path]))])
		);
		const manifest: PackageManifest = {
			schemaVersion: PACKAGE_SCHEMA_VERSION,
			tripId: core.tripId,
			packageVersion: snapshot.nextVersion,
			generatedAt,
			route: { routeId: core.routeId, fingerprint: context.routeFingerprint },
			snapshots: { core: snapshot.coreFingerprint, sources: snapshot.sourceFingerprint },
			policy: {
				generator: PACKAGE_POLICY_VERSION,
				coverage: safety.policy.version,
				approvalId: safety.policy.approvalId,
			},
			context,
			hazardSourceSummary: safety.feeds.map((feed) => ({
				sourceId: feed.sourceId,
				sourceType: feed.sourceType,
				sourceVersion: feed.sourceVersion,
				sourceReference: feed.sourceReference,
				status: feed.status,
				checkedAt: feed.checkedAt,
				validUntil: feed.validUntil,
				outcome: ["AVAILABLE", "EMPTY"].includes(feed.status)
					? hazards.some((hazard) => hazard.sourceId === feed.sourceId)
						? "ACTIVE_ALERTS"
						: "NO_ACTIVE_ALERT"
					: "UNKNOWN",
			})),
			guidance: guidance.map((g) => ({
				unitId: g.id,
				documentVersionId: g.source.id,
				chunkSetId: g.chunkSet.id,
				chunkIds: g.chunkIds,
				approvalVersion: g.approval.version,
			})),
			files: PAYLOAD_PATHS.map((path) => ({
				path,
				sha256: digest(encoded[path]),
				sizeBytes: encoded[path].length,
			})),
		};
		const manifestBytes = Buffer.from(canonical(manifest));
		if (
			manifestBytes.length +
				Object.values(encoded).reduce((total, bytes) => total + bytes.length, 0) >
			MAX_PACKAGE_BYTES
		)
			throw new PackageFailure([PackageReason.PACKAGE_TOO_LARGE]);
		const entries: Zippable = { "manifest.json": manifestBytes, ...encoded };
		// Fixed local calendar fields produce fixed ZIP DOS timestamps in every timezone.
		const bytes = Buffer.from(zipSync(entries, { level: 0, mtime: new Date(1980, 0, 1) }));
		if (bytes.length > MAX_PACKAGE_BYTES)
			throw new PackageFailure([PackageReason.PACKAGE_TOO_LARGE]);
		this.verify(bytes, manifest);
		return { bytes, manifest, sha256: digest(bytes) };
	}
	verify(bytes: Buffer, manifest: PackageManifest): void {
		try {
			if (bytes.length > MAX_PACKAGE_BYTES || manifest.schemaVersion !== PACKAGE_SCHEMA_VERSION)
				throw new Error();
			let expanded = 0;
			const files = unzipSync(bytes, {
				filter: (entry: UnzipFileInfo) => {
					expanded += entry.originalSize;
					if (
						expanded > MAX_PACKAGE_BYTES ||
						!["manifest.json", ...PAYLOAD_PATHS].includes(entry.name)
					)
						throw new Error();
					return true;
				},
			});
			if (
				Object.keys(files).length !== PAYLOAD_PATHS.length + 1 ||
				Buffer.from(files["manifest.json"]).toString("utf8") !== canonical(manifest) ||
				manifest.files.length !== PAYLOAD_PATHS.length
			)
				throw new Error();
			for (const path of PAYLOAD_PATHS) {
				const expected = manifest.files.filter((file) => file.path === path);
				if (
					expected.length !== 1 ||
					!files[path] ||
					files[path].length !== expected[0].sizeBytes ||
					digest(Buffer.from(files[path])) !== expected[0].sha256
				)
					throw new Error();
			}
		} catch {
			throw new PackageFailure([PackageReason.ARTIFACT_INVALID]);
		}
	}
}
