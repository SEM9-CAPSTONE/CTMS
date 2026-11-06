import {
	fictionalPackageCore,
	fictionalPackageSafety,
} from "../../../test/support/offline-package-fixture";
import { TripStatus } from "../trips/entities/trip.entity";
import type {
	NormalizedPackageHazard,
	PackageCore,
	PackageSafetyInputs,
} from "./offline-packages.types";
import { PackageFailure, PackageReason } from "./offline-packages.types";
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
	canonical,
	digest,
	generationKey,
	sourceFingerprint,
} from "./package-policy";

describe("CTMS-052 eligibility gates (BR-229/365/428)", () => {
	const now = Date.parse("2026-11-06T00:00:00Z");
	let core: PackageCore;
	let input: PackageSafetyInputs;
	const contexts = new TripSafetyContextResolver();
	const hazards = new EligibleHazardResolver();
	const guidance = new ApprovedGuidanceSelector();
	const validator = new PackageEligibilityValidator();
	beforeEach(() => {
		core = fictionalPackageCore();
		input = fictionalPackageSafety();
	});
	function validate(): void {
		const context = contexts.resolve(core, input);
		validator.validate(
			core,
			input,
			context,
			hazards.resolve(input, context, now),
			guidance.select(input, context, now),
			now
		);
	}
	function rejects(reason: PackageReason): void {
		try {
			validate();
			throw new Error("Expected blocked package");
		} catch (error) {
			expect(error).toBeInstanceOf(PackageFailure);
			expect((error as PackageFailure).reasons).toContain(reason);
		}
	}
	function hazard(): NormalizedPackageHazard {
		input.feeds[0].status = "AVAILABLE";
		return {
			id: "hazard",
			sourceType: "GOVERNMENT",
			sourceId: "fictional-provider",
			sourceVersion: "fictional-run-1",
			sourceReference: "https://example.org/fictional-hazard",
			geometry: { type: "Point", coordinates: [108, 16] },
			geometryRole: "OBSERVED_POINT",
			accuracyMeters: 10,
			hazardType: "flood",
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
	}
	it("accepts a complete published Trip with an explicitly checked empty source", () => {
		expect(validate).not.toThrow();
	});
	it.each([TripStatus.DRAFT, TripStatus.PENDING_APPROVAL, TripStatus.ONGOING])(
		"rejects %s",
		(status) => {
			core.status = status;
			rejects(PackageReason.TRIP_NOT_PUBLISHED);
		}
	);
	it("rejects sparse, cross-route and cross-checkpoint data", () => {
		core.checkpoints = [];
		rejects(PackageReason.CORE_INCOMPLETE);
		core = fictionalPackageCore();
		core.checkpoints[0].routeId = "other";
		rejects(PackageReason.CORE_INCOMPLETE);
		core = fictionalPackageCore();
		core.waypoints[0].checkpointId = "other";
		rejects(PackageReason.CORE_INCOMPLETE);
	});
	it.each(["UNAVAILABLE", "PARTIAL", "STALE"] as const)("does not treat %s as empty", (status) => {
		input.feeds[0].status = status;
		rejects(PackageReason.HAZARD_FEED_UNAVAILABLE);
	});
	it("rejects expired and inconsistent official runs instead of hiding hazards", () => {
		input.feeds[0].validUntil = "2026-01-01";
		rejects(PackageReason.HAZARD_FEED_STALE);
		input = fictionalPackageSafety();
		input.hazards = [hazard()];
		input.hazards[0].sourceVersion = "wrong-version";
		rejects(PackageReason.HAZARD_FEED_INVALID);
	});
	it("accepts current official hazards and rejects invalid spatial/expiry evidence", () => {
		input.hazards = [hazard()];
		expect(validate).not.toThrow();
		input.hazards[0].match.distanceMeters = 500;
		rejects(PackageReason.HAZARD_FEED_INVALID);
		input.hazards[0].match.distanceMeters = 0;
		input.hazards[0].validUntil = "2026-01-01";
		rejects(PackageReason.HAZARD_FEED_INVALID);
	});
	it("requires an independent authorized Host decision for field evidence", () => {
		const field = hazard();
		field.sourceType = "FIELD_VERIFIED";
		field.verification = "VERIFIED";
		input.feeds.push({ ...input.feeds[0], sourceId: "field", sourceType: "FIELD_VERIFIED" });
		field.sourceId = "field";
		input.feeds[0].status = "EMPTY";
		input.hazards = [field];
		const context = contexts.resolve(core, input);
		expect(hazards.resolve(input, context, now)).toEqual([]);
		field.hostDecision = {
			id: "decision",
			reportId: "private-report",
			version: "1",
			status: "APPROVED",
			verifiedByHostId: "private-host",
			authorized: true,
			verifiedAt: "2026-01-01",
			evidenceRef: "private-proof",
		};
		expect(hazards.resolve(input, context, now)).toEqual([field]);
		field.hostDecision.authorized = false;
		expect(hazards.resolve(input, context, now)).toEqual([]);
		field.hostDecision.authorized = true;
		for (const status of ["REJECTED", "REVOKED"] as const) {
			field.hostDecision.status = status;
			expect(hazards.resolve(input, context, now)).toEqual([]);
		}
	});
	it.each(["HOST_DEFINED", "FIELD_OBSERVATION"] as const)(
		"excludes %s even with operational resolved/closed metadata",
		(sourceType) => {
			const record = Object.assign(hazard(), { sourceType, incidentStatus: "resolved" });
			input.hazards = [record];
			expect(hazards.resolve(input, contexts.resolve(core, input), now)).toEqual([]);
		}
	);
	it("does not infer diving/crossing guidance from forest or nearby water", () => {
		input.conditionEvidence = [
			{ code: "forest", state: "CONFIRMED", evidenceRef: "route-evidence" },
		];
		const unit = input.guidance[0];
		unit.applicableConditions = ["river_crossing"];
		rejects(PackageReason.GUIDANCE_COVERAGE_INCOMPLETE);
		input.conditionEvidence.push({
			code: "river_crossing",
			state: "CONFIRMED",
			evidenceRef: "crossing-evidence",
		});
		expect(validate).not.toThrow();
		unit.applicableConditions = ["diving"];
		rejects(PackageReason.GUIDANCE_COVERAGE_INCOMPLETE);
	});
	it("blocks required UNKNOWN context and unknown exclusions", () => {
		if (!input.policy) throw new Error();
		input.policy.requiredConditions = ["river_crossing"];
		rejects(PackageReason.CONTEXT_UNKNOWN);
		input.conditionEvidence.push({
			code: "river_crossing",
			state: "NOT_APPLICABLE",
			evidenceRef: "review",
		});
		expect(validate).not.toThrow();
		input.guidance[0].excludedConditions = ["diving"];
		rejects(PackageReason.GUIDANCE_COVERAGE_INCOMPLETE);
	});
	it.each(["rights", "version", "chunks", "approval", "complete", "pages", "checksum"])(
		"blocks invalid guidance %s",
		(invalid) => {
			const unit = input.guidance[0];
			switch (invalid) {
				case "rights":
					unit.source.rights.offlineRedistributionAllowed = false;
					break;
				case "version":
					unit.currentPublishedVersionId = "new-version";
					break;
				case "chunks":
					unit.chunkSet.status = "PENDING";
					break;
				case "approval":
					unit.approval.status = "REVOKED";
					break;
				case "complete":
					unit.complete = false;
					break;
				case "pages":
					unit.pageRefs = [];
					break;
				case "checksum":
					unit.source.checksum = "";
					unit.chunkSet.sourceChecksum = "";
					break;
			}
			rejects(PackageReason.GUIDANCE_COVERAGE_INCOMPLETE);
		}
	);
	it("blocks medical/personal content flags (BR-230)", () => {
		input.guidance[0].containsPersonalData = true;
		rejects(PackageReason.PERSONAL_DATA_FORBIDDEN);
	});
	it("requires approved coverage policy and respects upstream blockers", () => {
		input.policy = null;
		rejects(PackageReason.GUIDANCE_POLICY_UNAVAILABLE);
		input = fictionalPackageSafety();
		input.blockers.push(PackageReason.GUIDANCE_APPROVAL_UNAVAILABLE);
		rejects(PackageReason.GUIDANCE_APPROVAL_UNAVAILABLE);
	});
	it("has stable semantic identities while preserving material source changes", () => {
		const initial = sourceFingerprint(input);
		input.feeds[0].checkedAt = "2026-11-05";
		input.revision = "checked-again";
		expect(sourceFingerprint(input)).toBe(initial);
		input.guidance[0].approval.version = "2";
		expect(sourceFingerprint(input)).not.toBe(initial);
		expect(generationKey("core", initial)).toBe(generationKey("core", initial));
		expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
	});
	it("keeps source identity stable across unordered upstream rows", () => {
		input.guidance.push({ ...input.guidance[0], id: "another-unit" });
		input.feeds.push({ ...input.feeds[0], sourceId: "another-provider" });
		const initial = sourceFingerprint(input);
		input.guidance.reverse();
		input.feeds.reverse();
		expect(sourceFingerprint(input)).toBe(initial);
	});
});
