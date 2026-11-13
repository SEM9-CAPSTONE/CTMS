import { createHash } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ROUTE_DEVIATION_ANALYSIS_VERSION } from "../route-deviation-analysis/route-deviation-analysis.constants";
import { clusterEvents } from "./hotspot-clustering";
import {
	SAFETY_HOTSPOT_ANALYSIS_VERSION,
	SAFETY_HOTSPOT_CONFIG_VERSION,
	SAFETY_HOTSPOT_CRITERIA,
	SAFETY_HOTSPOT_LIST_DEFAULT_LIMIT,
	SAFETY_HOTSPOT_LIST_MAX_LIMIT,
} from "./safety-hotspots.constants";
import { SafetyHotspotSkipReason, SafetyHotspotStatus } from "./safety-hotspots.enums";
import {
	type EligibleDeviationEvent,
	type NearbyHotspot,
	type SafetyHotspotRow,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	SafetyHotspotsRepository,
} from "./safety-hotspots.repository";

export interface HotspotDetectionResult {
	runId: string;
	windowStart: string;
	windowEnd: string;
	eventsConsidered: number;
	clustersFound: number;
	candidatesCreated: number;
	createdHotspotIds: string[];
	skipped: Partial<Record<SafetyHotspotSkipReason, number>>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Candidates that already stand for a place and stop a new one there. */
const COVERING_STATUSES = new Set<SafetyHotspotStatus>([
	SafetyHotspotStatus.DETECTED,
	SafetyHotspotStatus.UNDER_REVIEW,
	SafetyHotspotStatus.CONFIRMED,
]);

/** Order-independent fingerprint of a cluster's evidence. */
export function evidenceHash(eventIds: string[]): string {
	return createHash("sha256")
		.update([...eventIds].sort().join(","))
		.digest("hex");
}

/**
 * BR-421 / BR-422 policy for a qualifying cluster at a place that already has candidates:
 * an open or confirmed candidate covers it; a dismissed one only allows a new candidate when
 * some evidence started after that dismissal (the new one then links back to it).
 */
export function decideAgainstExisting(
	nearby: NearbyHotspot[],
	lastEventAt: Date
):
	| { create: false; reason: SafetyHotspotSkipReason }
	| { create: true; previousHotspotId: string | null } {
	if (nearby.some((hotspot) => COVERING_STATUSES.has(hotspot.status))) {
		return { create: false, reason: SafetyHotspotSkipReason.ALREADY_COVERED };
	}
	const dismissed = nearby
		.filter((hotspot) => hotspot.status === SafetyHotspotStatus.DISMISSED)
		.sort(
			(a, b) => new Date(b.statusChangedAt).getTime() - new Date(a.statusChangedAt).getTime()
		)[0];
	if (!dismissed) return { create: true, previousHotspotId: null };
	return lastEventAt.getTime() > new Date(dismissed.statusChangedAt).getTime()
		? { create: true, previousHotspotId: dismissed.id }
		: { create: false, reason: SafetyHotspotSkipReason.DISMISSED_WITHOUT_NEW_EVIDENCE };
}

/**
 * CTMS-116: detects PotentialSafetyHotspot candidates from authoritative RouteDeviationEvents
 * (BR-355, BR-417, BR-418). Advisory only: it writes nothing but hotspot tables (BR-356).
 */
@Injectable()
export class SafetyHotspotsService {
	constructor(private readonly repository: SafetyHotspotsRepository) {}

	async detect(
		triggeredBy: string | null,
		now: Date = new Date()
	): Promise<HotspotDetectionResult> {
		const windowEnd = now;
		const windowStart = new Date(now.getTime() - SAFETY_HOTSPOT_CRITERIA.windowDays * DAY_MS);
		return this.repository.transaction(async (manager) => {
			await this.repository.lockDetection(manager);
			const events = await this.repository.findEligibleEvents(
				manager,
				ROUTE_DEVIATION_ANALYSIS_VERSION,
				windowStart,
				windowEnd
			);
			const runId = await this.repository.insertRun(manager, {
				analysisVersion: SAFETY_HOTSPOT_ANALYSIS_VERSION,
				configVersion: SAFETY_HOTSPOT_CONFIG_VERSION,
				criteria: {
					...SAFETY_HOTSPOT_CRITERIA,
					deviationAnalysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
				},
				windowStart,
				windowEnd,
				eventsConsidered: events.length,
				triggeredBy,
				ranAt: now,
			});

			const neighbors = new Map<string, Set<string>>();
			for (const { a, b } of await this.repository.findNeighborPairs(
				manager,
				events.map((event) => event.id),
				SAFETY_HOTSPOT_CRITERIA.clusterRadiusMeters
			)) {
				neighbors.set(a, (neighbors.get(a) ?? new Set()).add(b));
			}

			// AC1 / BR-421: one Route version at a time, never mixed.
			const groups = new Map<string, EligibleDeviationEvent[]>();
			for (const event of events) {
				const key = `${event.routeId}:${event.routeVersion}`;
				groups.set(key, [...(groups.get(key) ?? []), event]);
			}

			let clustersFound = 0;
			const created: string[] = [];
			const skipped: Partial<Record<SafetyHotspotSkipReason, number>> = {};
			const skip = (reason: SafetyHotspotSkipReason) => {
				skipped[reason] = (skipped[reason] ?? 0) + 1;
			};
			for (const group of groups.values()) {
				const { routeId, routeVersion } = group[0];
				for (const cluster of clusterEvents(group, neighbors)) {
					clustersFound += 1;
					const summary = await this.repository.summarizeCluster(manager, cluster.eventIds);
					const nearby = await this.repository.findNearbyHotspots(
						manager,
						routeId,
						routeVersion,
						{ lng: summary.centerLng, lat: summary.centerLat },
						SAFETY_HOTSPOT_CRITERIA.clusterRadiusMeters
					);
					const decision = decideAgainstExisting(nearby, summary.lastEventAt);
					if (!decision.create) {
						skip(decision.reason);
						continue;
					}
					const id = await this.repository.insertHotspot(manager, {
						routeId,
						routeVersion,
						analysisVersion: SAFETY_HOTSPOT_ANALYSIS_VERSION,
						configVersion: SAFETY_HOTSPOT_CONFIG_VERSION,
						criteria: {
							...SAFETY_HOTSPOT_CRITERIA,
							deviationAnalysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
						},
						windowStart,
						windowEnd,
						centerLng: summary.centerLng,
						centerLat: summary.centerLat,
						radiusMeters: SAFETY_HOTSPOT_CRITERIA.clusterRadiusMeters,
						anchorEventId: cluster.anchorId,
						routeFractionMin: summary.routeFractionMin,
						routeFractionMax: summary.routeFractionMax,
						eventCount: cluster.eventCount,
						distinctTripCount: cluster.distinctTrips,
						distinctMemberCount: cluster.distinctMembers,
						evidenceEventIds: cluster.eventIds,
						evidenceHash: evidenceHash(cluster.eventIds),
						firstEventAt: summary.firstEventAt,
						lastEventAt: summary.lastEventAt,
						previousHotspotId: decision.previousHotspotId,
						detectionRunId: runId,
						detectedAt: now,
					});
					if (id) created.push(id);
					else skip(SafetyHotspotSkipReason.DUPLICATE_EVIDENCE);
				}
			}

			await this.repository.finishRun(manager, runId, {
				clustersFound,
				candidatesCreated: created.length,
				skipped,
			});
			return {
				runId,
				windowStart: windowStart.toISOString(),
				windowEnd: windowEnd.toISOString(),
				eventsConsidered: events.length,
				clustersFound,
				candidatesCreated: created.length,
				createdHotspotIds: created,
				skipped,
			};
		});
	}

	async getById(id: string): Promise<SafetyHotspotRow> {
		const hotspot = await this.repository.findById(id);
		if (!hotspot) throw new NotFoundException("Hotspot not found");
		return hotspot;
	}

	list(filter: { routeId?: string; status?: SafetyHotspotStatus; limit?: number }): Promise<
		SafetyHotspotRow[]
	> {
		const limit = Math.min(
			Math.max(Math.trunc(filter.limit ?? SAFETY_HOTSPOT_LIST_DEFAULT_LIMIT), 1),
			SAFETY_HOTSPOT_LIST_MAX_LIMIT
		);
		return this.repository.list({ ...filter, limit });
	}
}
