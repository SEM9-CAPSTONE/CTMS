import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";
import {
	fictionalPackageCore,
	fictionalPackageSafety,
	fictionalPackageSafetyWithHazards,
} from "../../../test/support/offline-package-fixture";
import { PackageArtifactBuilder } from "./package-artifact.builder";
import { LocalPackageArtifactStorage } from "./package-artifact.storage";
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
	canonical,
	digest,
	sourceFingerprint,
} from "./package-policy";

describe("CTMS-052 final review: optional source freshness", () => {
	it.each(["AVAILABLE", "EMPTY"] as const)(
		"keeps an expired optional %s source UNKNOWN instead of reporting NO_ACTIVE_ALERT",
		(status) => {
			const core = fictionalPackageCore();
			const safety = fictionalPackageSafety();
			const now = Date.parse("2026-11-06T12:00:00Z");
			safety.feeds.push({
				...safety.feeds[0],
				sourceId: "optional-expired-provider",
				status,
				validUntil: "2026-01-02T00:00:00Z",
			});
			const context = new TripSafetyContextResolver().resolve(core, safety);
			const hazards = new EligibleHazardResolver().resolve(safety, context, now);
			const guidance = new ApprovedGuidanceSelector().select(safety, context, now);
			// The required source is healthy; optional-source limits must remain explicit.
			new PackageEligibilityValidator().validate(core, safety, context, hazards, guidance, now);
			const artifact = new PackageArtifactBuilder().build(
				{
					core,
					safety,
					coreFingerprint: digest(canonical(core)),
					sourceFingerprint: sourceFingerprint(safety),
					nextVersion: 1,
				},
				context,
				hazards,
				guidance,
				new Date(now).toISOString()
			);
			expect(
				artifact.manifest.hazardSourceSummary.find(
					(feed) => feed.sourceId === "optional-expired-provider"
				)?.outcome
			).toBe("UNKNOWN");
		}
	);
	it("persists a complete fixture ZIP and independently verifies actual file and payload SHA-256", async () => {
		const core = fictionalPackageCore();
		const safety = fictionalPackageSafetyWithHazards(core);
		const context = new TripSafetyContextResolver().resolve(core, safety);
		const now = Date.parse("2026-11-06T12:00:00.000Z");
		const hazards = new EligibleHazardResolver().resolve(safety, context, now);
		const guidance = new ApprovedGuidanceSelector().select(safety, context, now);
		new PackageEligibilityValidator().validate(core, safety, context, hazards, guidance, now);
		const artifact = new PackageArtifactBuilder().build(
			{
				core,
				safety,
				coreFingerprint: digest(canonical(core)),
				sourceFingerprint: sourceFingerprint(safety),
				nextVersion: 1,
			},
			context,
			hazards,
			guidance,
			new Date(now).toISOString()
		);
		const root = resolve(__dirname, "../../../test-results/ctms52-final-review-artifact");
		await mkdir(root, { recursive: true });
		const previous = process.env.OFFLINE_PACKAGE_STORAGE_ROOT;
		process.env.OFFLINE_PACKAGE_STORAGE_ROOT = root;
		try {
			await new LocalPackageArtifactStorage().put(`${artifact.sha256}.zip`, artifact.bytes);
			const path = join(root, `${artifact.sha256}.zip`);
			const bytes = await readFile(path);
			const sha256 = createHash("sha256").update(bytes).digest("hex");
			expect(sha256).toBe(artifact.sha256);
			const entries = unzipSync(bytes);
			const payload = (name: string): unknown =>
				JSON.parse(Buffer.from(entries[name]).toString("utf8"));
			expect(Object.keys(entries)).toHaveLength(6);
			expect(payload("route.geojson")).toMatchObject({ properties: { routeId: core.routeId } });
			expect(payload("checkpoints.json")).toHaveLength(1);
			expect(payload("waypoints.json")).toHaveLength(2);
			expect(payload("hazards.geojson")).toMatchObject({
				features: [
					expect.objectContaining({
						properties: expect.objectContaining({ sourceType: "FIELD_VERIFIED" }),
					}),
					expect.objectContaining({
						properties: expect.objectContaining({ sourceType: "GOVERNMENT" }),
					}),
				],
			});
			expect(payload("guidance.json")).toHaveLength(1);
			for (const file of artifact.manifest.files)
				expect(createHash("sha256").update(entries[file.path]).digest("hex")).toBe(file.sha256);
			await writeFile(
				join(root, "evidence.json"),
				JSON.stringify(
					{
						path,
						sha256,
						sizeBytes: bytes.length,
						files: artifact.manifest.files,
						hazardSources: ["GOVERNMENT", "FIELD_VERIFIED"],
						fixtureOnly: true,
						databaseUsed: false,
					},
					null,
					2
				)
			);
		} finally {
			if (previous === undefined)
				Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_STORAGE_ROOT");
			else process.env.OFFLINE_PACKAGE_STORAGE_ROOT = previous;
		}
	});
});
