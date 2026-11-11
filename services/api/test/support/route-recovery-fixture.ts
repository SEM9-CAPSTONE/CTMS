import { randomUUID } from "node:crypto";
import type { PackageMetadata } from "../../src/modules/offline-packages/offline-packages.types";
import { PackageArtifactBuilder } from "../../src/modules/offline-packages/package-artifact.builder";
import {
	TripSafetyContextResolver,
	canonical,
	digest,
	sourceFingerprint,
} from "../../src/modules/offline-packages/package-policy";
import { fictionalPackageCore, fictionalPackageSafety } from "./offline-package-fixture";

export function recoveryFixture(tripId = randomUUID(), routeId = randomUUID(), version = 1) {
	const core = fictionalPackageCore();
	core.tripId = tripId;
	core.routeId = routeId;
	const safety = fictionalPackageSafety();
	const artifact = new PackageArtifactBuilder().build(
		{
			core,
			safety,
			nextVersion: version,
			coreFingerprint: digest(canonical(core)),
			sourceFingerprint: sourceFingerprint(safety),
		},
		new TripSafetyContextResolver().resolve(core, safety),
		[],
		safety.guidance,
		"2026-11-11T00:00:00.000Z"
	);
	const metadata: PackageMetadata = {
		id: randomUUID(),
		trip_id: tripId,
		package_version: version,
		generation_key: artifact.sha256,
		schema_version: 1,
		manifest: artifact.manifest,
		sha256: artifact.sha256,
		size_bytes: artifact.bytes.length,
		artifact_key: `${artifact.sha256}.zip`,
		generated_at: new Date(artifact.manifest.generatedAt),
	};
	return { ...artifact, metadata, geometry: core.geometry };
}
