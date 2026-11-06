import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ChunkSetStatus } from "../knowledge-chunks/knowledge-chunks.types";
import { isSafetyGeometry } from "../route-safety/safety-input";
import {
	assertRights,
	hasRecordedUseRights,
	validatePublicationMetadata,
} from "../survival-documents/source-policy";
import { DocumentStatus } from "../survival-documents/survival-documents.types";
import { isCanonicalLineStringCoordinates } from "../trekking-routes/validators/line-string.validator";
import { WaypointType } from "../trips/entities/trip-waypoint.entity";
import { TripStatus, TripType } from "../trips/entities/trip.entity";
import {
	type ApprovedGuidanceUnit,
	MAX_ITEMS,
	type NormalizedPackageHazard,
	PACKAGE_POLICY_VERSION,
	type PackageCore,
	PackageFailure,
	PackageReason,
	type PackageSafetyInputs,
	type TripSafetyContext,
} from "./offline-packages.types";

export function canonical(value: unknown): string {
	function ordered(input: unknown): unknown {
		if (input === null || typeof input === "string" || typeof input === "boolean") return input;
		if (typeof input === "number" && Number.isFinite(input)) return input;
		if (input instanceof Date) return input.toISOString();
		if (Array.isArray(input)) return input.map(ordered);
		if (typeof input === "object" && input !== null)
			return Object.fromEntries(
				Object.entries(input)
					.filter(([, v]) => v !== undefined)
					.sort(([a], [b]) => a.localeCompare(b, "en"))
					.map(([k, v]) => [k, ordered(v)])
			);
		throw new PackageFailure([PackageReason.CORE_INCOMPLETE]);
	}
	return JSON.stringify(ordered(value));
}
export function digest(value: string | Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}
export function sourceFingerprint(input: PackageSafetyInputs): string {
	const { revision: _revision, feeds, ...semantic } = input;
	const sorted = <T>(items: T[]): T[] =>
		[...items].sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
	return digest(
		canonical({
			...semantic,
			conditionEvidence: sorted(input.conditionEvidence),
			hazards: sorted(input.hazards),
			guidance: sorted(input.guidance),
			blockers: [...input.blockers].sort(),
			feeds: sorted(feeds.map(({ checkedAt: _checkedAt, ...feed }) => feed)),
		})
	);
}
export function generationKey(coreFingerprint: string, sources: string): string {
	return digest(canonical({ coreFingerprint, sources, policy: PACKAGE_POLICY_VERSION }));
}
const validTime = (value: string | null): value is string =>
	!!value && Number.isFinite(Date.parse(value));
const current = (from: string, until: string, now: number): boolean =>
	validTime(from) && validTime(until) && Date.parse(from) <= now && Date.parse(until) > now;

@Injectable()
export class TripSafetyContextResolver {
	resolve(core: PackageCore, input: PackageSafetyInputs): TripSafetyContext {
		const codes = new Set([
			...(input.policy?.requiredConditions ?? []),
			...(input.policy?.conditionTopics.map((rule) => rule.condition) ?? []),
			...input.guidance.flatMap((unit) => [
				...unit.applicableConditions,
				...unit.excludedConditions,
			]),
		]);
		codes.add(TripType.DAY_TRIP);
		codes.add(TripType.OVERNIGHT);
		return {
			tripId: core.tripId,
			routeId: core.routeId,
			routeFingerprint: digest(canonical(core.geometry)),
			startsAt: core.startsAt,
			endsAt: core.endsAt,
			tripType: core.tripType,
			policyVersion: PACKAGE_POLICY_VERSION,
			conditions: [...codes].sort().map((code) => {
				if (code === TripType.DAY_TRIP || code === TripType.OVERNIGHT)
					return {
						code,
						state: code === core.tripType ? "CONFIRMED" : "NOT_APPLICABLE",
						evidenceRef: `trip:${core.tripId}:trip_type`,
					};
				const evidence = input.conditionEvidence.filter(
					(condition) => condition.code === code && condition.evidenceRef
				);
				return evidence.length === 1
					? { code, state: evidence[0].state, evidenceRef: evidence[0].evidenceRef }
					: { code, state: "UNKNOWN", evidenceRef: null };
			}),
		};
	}
}

@Injectable()
export class EligibleHazardResolver {
	resolve(
		input: PackageSafetyInputs,
		context: TripSafetyContext,
		now: number
	): NormalizedPackageHazard[] {
		return input.hazards
			.filter((hazard) => {
				if (
					!hazard.id ||
					!hazard.sourceVersion ||
					!hazard.sourceReference ||
					!hazard.geometryRole ||
					!isSafetyGeometry(hazard.geometry) ||
					hazard.lifecycle !== "ACTIVE" ||
					!current(hazard.validFrom, hazard.validUntil, now)
				)
					return false;
				const feed = input.feeds.find(
					(source) =>
						source.sourceId === hazard.sourceId &&
						source.sourceType === hazard.sourceType &&
						source.sourceVersion === hazard.sourceVersion
				);
				if (
					!feed ||
					feed.status !== "AVAILABLE" ||
					!validTime(feed.checkedAt) ||
					Date.parse(feed.checkedAt) > now ||
					!validTime(feed.validUntil) ||
					Date.parse(feed.validUntil) <= now
				)
					return false;
				const match = hazard.match;
				if (
					match.routeFingerprint !== context.routeFingerprint ||
					!Number.isFinite(match.distanceMeters) ||
					match.distanceMeters < 0 ||
					!Number.isFinite(match.proximityMeters) ||
					match.proximityMeters < 0
				)
					return false;
				if (
					hazard.geometry.type === "Point"
						? match.distanceMeters > match.proximityMeters
						: !match.intersects
				)
					return false;
				switch (hazard.sourceType) {
					case "GOVERNMENT":
						return hazard.verification === "SOURCE_PROVIDED";
					case "FIELD_VERIFIED": {
						const decision = hazard.hostDecision;
						return (
							hazard.verification === "VERIFIED" &&
							!!decision &&
							decision.status === "APPROVED" &&
							decision.authorized === true &&
							!!decision.id &&
							!!decision.version &&
							!!decision.reportId &&
							!!decision.verifiedByHostId &&
							!!decision.evidenceRef &&
							validTime(decision.verifiedAt) &&
							Date.parse(decision.verifiedAt) <= now
						);
					}
					default:
						return false;
				}
			})
			.sort((a, b) => a.id.localeCompare(b.id, "en"));
	}
}

@Injectable()
export class ApprovedGuidanceSelector {
	select(
		input: PackageSafetyInputs,
		context: TripSafetyContext,
		now: number
	): ApprovedGuidanceUnit[] {
		const states = new Map(
			context.conditions.map((condition) => [condition.code, condition.state])
		);
		return input.guidance
			.filter((unit) => {
				if (
					!unit.id ||
					!unit.topic ||
					!unit.source.id ||
					!unit.source.documentId ||
					!unit.chunkSet.id ||
					!/^[a-f0-9]{64}$/.test(unit.source.checksum)
				)
					return false;
				if (
					!unit.complete ||
					!unit.content.trim() ||
					unit.approval.status !== "APPROVED" ||
					!unit.approval.id ||
					!unit.approval.version ||
					!unit.approval.approvedBy ||
					!unit.approval.taxonomyVersion ||
					!validTime(unit.approval.approvedAt) ||
					Date.parse(unit.approval.approvedAt) > now
				)
					return false;
				if (
					unit.source.status !== DocumentStatus.PUBLISHED ||
					unit.currentPublishedVersionId !== unit.source.id ||
					!hasRecordedUseRights(unit.source)
				)
					return false;
				if (
					unit.chunkSet.status !== ChunkSetStatus.READY ||
					unit.chunkSet.documentVersionId !== unit.source.id ||
					unit.chunkSet.sourceChecksum !== unit.source.checksum
				)
					return false;
				if (
					!unit.chunkIds.length ||
					new Set(unit.chunkIds).size !== unit.chunkIds.length ||
					!unit.chunkIds.every((id) =>
						unit.pageRefs.some(
							(page) =>
								page.chunkId === id &&
								Number.isSafeInteger(page.page) &&
								page.page > 0 &&
								!!page.itemRef
						)
					)
				)
					return false;
				if (!unit.applicableConditions.every((condition) => states.get(condition) === "CONFIRMED"))
					return false;
				// Unknown exclusions cannot establish safe applicability.
				if (
					!unit.excludedConditions.every((condition) => states.get(condition) === "NOT_APPLICABLE")
				)
					return false;
				try {
					validatePublicationMetadata(unit.source.metadata);
					assertRights(unit.source.metadata, unit.source.rights, "OFFLINE");
					return true;
				} catch {
					return false;
				}
			})
			.sort((a, b) => a.id.localeCompare(b.id, "en"));
	}
}

@Injectable()
export class PackageEligibilityValidator {
	validate(
		core: PackageCore,
		input: PackageSafetyInputs,
		context: TripSafetyContext,
		hazards: NormalizedPackageHazard[],
		guidance: ApprovedGuidanceUnit[],
		now: number
	): void {
		const reasons = new Set(input.blockers);
		if (core.status !== TripStatus.PUBLISHED) reasons.add(PackageReason.TRIP_NOT_PUBLISHED);
		if (
			!core.geometry ||
			core.geometry.type !== "LineString" ||
			!isCanonicalLineStringCoordinates(core.geometry.coordinates) ||
			core.geometry.coordinates.length > MAX_ITEMS ||
			new Set(core.geometry.coordinates.map((point) => point.join(","))).size < 2 ||
			!validTime(core.startsAt) ||
			!validTime(core.endsAt) ||
			Date.parse(core.endsAt) <= Date.parse(core.startsAt)
		)
			reasons.add(PackageReason.CORE_INCOMPLETE);
		if (
			core.checkpoints.length > MAX_ITEMS ||
			core.waypoints.length > MAX_ITEMS ||
			input.hazards.length > MAX_ITEMS ||
			input.guidance.length > MAX_ITEMS
		)
			reasons.add(PackageReason.PACKAGE_TOO_LARGE);
		const checkpointIds = new Set(core.checkpoints.map((point) => point.id));
		const waypointIds = new Set(core.waypoints.map((point) => point.id));
		if (
			!core.tripId ||
			!core.routeId ||
			checkpointIds.size !== core.checkpoints.length ||
			waypointIds.size !== core.waypoints.length ||
			core.checkpoints.some(
				(point) =>
					!point.id ||
					point.routeId !== core.routeId ||
					point.location?.type !== "Point" ||
					!isSafetyGeometry(point.location) ||
					!Number.isFinite(point.radiusMeters) ||
					point.radiusMeters <= 0 ||
					!Number.isFinite(point.routePosition) ||
					!Number.isSafeInteger(point.expectedArrivalOffset) ||
					point.expectedArrivalOffset < 0
			) ||
			core.waypoints.some(
				(point) =>
					!point.id ||
					point.location?.type !== "Point" ||
					!isSafetyGeometry(point.location) ||
					!validTime(point.plannedAt) ||
					!Number.isSafeInteger(point.dayNumber) ||
					point.dayNumber < 1 ||
					!Number.isSafeInteger(point.sequenceOrder) ||
					point.sequenceOrder < 0 ||
					(point.durationMinutes !== null &&
						(!Number.isSafeInteger(point.durationMinutes) || point.durationMinutes < 0)) ||
					(!!point.checkpointId && !checkpointIds.has(point.checkpointId))
			)
		)
			reasons.add(PackageReason.CORE_INCOMPLETE);
		if (
			[WaypointType.START, WaypointType.FINISH].some(
				(type) => core.waypoints.filter((point) => point.type === type).length !== 1
			)
		)
			reasons.add(PackageReason.CORE_INCOMPLETE);
		const policy = input.policy;
		if (
			!policy ||
			!policy.version ||
			!policy.approvalId ||
			!policy.baselineTopics.length ||
			!policy.requiredGovernmentSources.length
		)
			reasons.add(PackageReason.GUIDANCE_POLICY_UNAVAILABLE);
		if (policy) {
			if (
				(policy.requireCheckpoints && !core.checkpoints.length) ||
				policy.requiredWaypointTypes.some(
					(type) => !core.waypoints.some((point) => point.type === type)
				)
			)
				reasons.add(PackageReason.CORE_INCOMPLETE);
			if (
				policy.requiredConditions.some(
					(code) =>
						!context.conditions.some(
							(condition) => condition.code === code && condition.state !== "UNKNOWN"
						)
				)
			)
				reasons.add(PackageReason.CONTEXT_UNKNOWN);
			for (const sourceId of policy.requiredGovernmentSources) {
				const feeds = input.feeds.filter(
					(feed) => feed.sourceId === sourceId && feed.sourceType === "GOVERNMENT"
				);
				const feed = feeds[0];
				if (feeds.length !== 1 || !feed || !["AVAILABLE", "EMPTY"].includes(feed.status)) {
					reasons.add(PackageReason.HAZARD_FEED_UNAVAILABLE);
					continue;
				}
				if (
					!feed.sourceVersion ||
					!feed.sourceReference ||
					!validTime(feed.checkedAt) ||
					Date.parse(feed.checkedAt) > now
				)
					reasons.add(PackageReason.HAZARD_FEED_INVALID);
				if (
					feed.validUntil !== null &&
					(!validTime(feed.validUntil) || Date.parse(feed.validUntil) <= now)
				)
					reasons.add(PackageReason.HAZARD_FEED_STALE);
				if (feed.status === "AVAILABLE" && !validTime(feed.validUntil))
					reasons.add(PackageReason.HAZARD_FEED_STALE);
				// Any ACTIVE matched record that fails provenance/verification cannot disappear as 'no alert'.
				const active = input.hazards.filter(
					(hazard) =>
						hazard.sourceId === sourceId &&
						hazard.sourceType === "GOVERNMENT" &&
						hazard.lifecycle === "ACTIVE"
				);
				if (
					(feed.status === "EMPTY" && active.length > 0) ||
					active.some((hazard) => !hazards.includes(hazard))
				)
					reasons.add(PackageReason.HAZARD_FEED_INVALID);
			}
			const requiredTopics = new Set(policy.baselineTopics);
			for (const rule of policy.conditionTopics)
				if (
					context.conditions.some(
						(condition) => condition.code === rule.condition && condition.state === "CONFIRMED"
					)
				)
					requiredTopics.add(rule.topic);
			for (const rule of policy.hazardTopics)
				if (hazards.some((hazard) => hazard.hazardType === rule.hazardType))
					requiredTopics.add(rule.topic);
			if ([...requiredTopics].some((topic) => !guidance.some((unit) => unit.topic === topic)))
				reasons.add(PackageReason.GUIDANCE_COVERAGE_INCOMPLETE);
		}
		if (
			hazards.some((hazard) => hazard.containsPersonalData) ||
			guidance.some((unit) => unit.containsPersonalData)
		)
			reasons.add(PackageReason.PERSONAL_DATA_FORBIDDEN);
		if (reasons.size) throw new PackageFailure([...reasons].sort());
	}
}
