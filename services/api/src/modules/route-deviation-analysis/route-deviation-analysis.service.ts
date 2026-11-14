import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { type Participant, participationRejection } from "../gps-tracking/gps-participant";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { GpsLogRejectionReason, GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { TripStatus } from "../trips/entities/trip.entity";
import {
	DEVICE_EVENT_LINK_MARGIN_SECONDS,
	ROUTE_DEVIATION_ANALYSIS_VERSION,
	ROUTE_DEVIATION_EVENTS_DEFAULT_LIMIT,
	ROUTE_DEVIATION_EVENTS_MAX_LIMIT,
	ROUTE_DEVIATION_RUNTIME_CONTEXT,
} from "./route-deviation-analysis.constants";
import {
	RouteDeviationContextIssue,
	RouteDeviationExclusionReason,
} from "./route-deviation-analysis.enums";
import {
	type AnalysisTrip,
	type NewRouteDeviationEvent,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	RouteDeviationAnalysisRepository,
	type RouteDeviationEventRow,
	type StoredGpsSample,
	type TripAnalysisRow,
} from "./route-deviation-analysis.repository";
import {
	type ReplaySample,
	replayRouteDeviation,
	summarizeEpisode,
} from "./route-deviation-replay";

export type TripAnalysisOutcome =
	| { status: "analyzed"; analysisId: string; episodes: number }
	| { status: "skipped"; reason: "LOCKED" | "NOT_COMPLETED" | "NOT_FOUND" };

/**
 * CTMS-115: turns a completed Trip's stored GPS logs into RouteDeviationEvent episodes. Raw
 * evidence is only read; episodes are derived, versioned and replaced as a whole on re-run.
 */
@Injectable()
export class RouteDeviationAnalysisService {
	private readonly logger = new Logger(RouteDeviationAnalysisService.name);

	constructor(
		private readonly repository: RouteDeviationAnalysisRepository,
		private readonly participation: GpsParticipationSource
	) {}

	/** Worker pass: every completed Trip not yet analysed with the current version. */
	async analyzeDueTrips(
		limit: number
	): Promise<{ checked: number; analyzed: number; failed: number }> {
		const tripIds = await this.repository.findTripsToAnalyze(
			ROUTE_DEVIATION_ANALYSIS_VERSION,
			limit
		);
		let analyzed = 0;
		let failed = 0;
		for (const tripId of tripIds) {
			try {
				const outcome = await this.analyzeTrip(tripId, null, { skipLocked: true });
				if (outcome.status === "analyzed") analyzed += 1;
			} catch (error) {
				failed += 1;
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Route deviation analysis failed for trip ${tripId}: ${message}`);
			}
		}
		return { checked: tripIds.length, analyzed, failed };
	}

	/** Admin run (or re-run) for one Trip. AC1: only a completed Trip is analysed. */
	async runForTrip(tripId: string, adminId: string): Promise<TripAnalysisRow> {
		if (!(await this.repository.tripExists(tripId))) throw new NotFoundException("Trip not found");
		const outcome = await this.analyzeTrip(tripId, adminId, { skipLocked: false });
		if (outcome.status === "skipped") {
			throw new ConflictException("Only a completed Trip can be analysed for route deviations");
		}
		return (await this.repository.findAnalysis(
			tripId,
			ROUTE_DEVIATION_ANALYSIS_VERSION
		)) as TripAnalysisRow;
	}

	async analyzeTrip(
		tripId: string,
		triggeredBy: string | null,
		options: { skipLocked: boolean },
		now: Date = new Date()
	): Promise<TripAnalysisOutcome> {
		return this.repository.transaction(async (manager) => {
			const trip = await this.repository.lockTrip(manager, tripId, options.skipLocked);
			if (!trip) {
				return { status: "skipped", reason: options.skipLocked ? "LOCKED" : "NOT_FOUND" };
			}
			if (trip.status !== TripStatus.COMPLETED)
				return { status: "skipped", reason: "NOT_COMPLETED" };

			const samples = await this.repository.findSamples(manager, tripId);
			const excluded: Record<string, number> = {};
			const groups = new Map<string, StoredGpsSample[]>();
			const participants = new Map<string, Participant | null>();
			for (const sample of samples) {
				const key = `${sample.userId}:${sample.participantRole}`;
				if (!participants.has(key)) {
					participants.set(
						key,
						await this.resolveParticipant(tripId, sample.userId, sample.participantRole)
					);
				}
				const reason = this.exclusion(trip, participants.get(key) ?? null, sample);
				if (reason) {
					excluded[reason] = (excluded[reason] ?? 0) + 1;
					continue;
				}
				groups.set(key, [...(groups.get(key) ?? []), sample]);
			}

			const events: NewRouteDeviationEvent[] = [];
			for (const group of groups.values()) {
				const { userId, participantRole } = group[0];
				for (const episode of replayRouteDeviation(group.map(toReplaySample))) {
					const summary = summarizeEpisode(episode);
					const last = episode.recoveryConfirm ?? episode.end;
					const margin = DEVICE_EVENT_LINK_MARGIN_SECONDS * 1000;
					const deviceEvents = await this.repository.findDeviceEvents(
						manager,
						tripId,
						userId,
						new Date(episode.start.eventTime.getTime() - margin),
						new Date(last.eventTime.getTime() + margin)
					);
					const { packageVersion, issues } = packageContext(summary.packageVersions, trip);
					events.push({
						analysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
						configVersion: ROUTE_DEVIATION_RUNTIME_CONTEXT.configVersion,
						tripId,
						routeId: trip.routeId,
						routeVersion: trip.routeVersion,
						packageVersion,
						userId,
						participantRole,
						startedAt: episode.start.eventTime,
						confirmedAt: episode.confirm.eventTime,
						endedAt: episode.end.eventTime,
						recoveryConfirmedAt: episode.recoveryConfirm?.eventTime ?? null,
						endReason: episode.endReason,
						sampleCount: summary.sampleCount,
						validSampleCount: summary.validSampleCount,
						maxDistanceMeters: summary.maxDistanceMeters,
						avgDistanceMeters: summary.avgDistanceMeters,
						startLng: episode.start.lng,
						startLat: episode.start.lat,
						maxLng: summary.maxDistanceSample.lng,
						maxLat: summary.maxDistanceSample.lat,
						startRouteFraction: episode.start.routeFraction,
						startGpsLogId: episode.start.id,
						endGpsLogId: episode.end.id,
						deviceSafetyEventIds: deviceEvents,
						runtimeContext: { ...ROUTE_DEVIATION_RUNTIME_CONTEXT },
						authoritative: issues.length === 0,
						contextIssues: issues,
					});
				}
			}

			const analysisId = await this.repository.replaceAnalysis(
				manager,
				{
					tripId,
					analysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
					routeId: trip.routeId,
					routeVersion: trip.routeVersion,
					runtimeContext: { ...ROUTE_DEVIATION_RUNTIME_CONTEXT },
					participants: groups.size,
					samplesTotal: samples.length,
					samplesUsed: [...groups.values()].reduce((sum, group) => sum + group.length, 0),
					samplesExcluded: excluded,
					triggeredBy,
					analyzedAt: now,
				},
				events
			);
			return { status: "analyzed", analysisId, episodes: events.length };
		});
	}

	async getTripAnalysis(
		tripId: string
	): Promise<{ analysis: TripAnalysisRow; events: RouteDeviationEventRow[] }> {
		const analysis = await this.repository.findAnalysis(tripId, ROUTE_DEVIATION_ANALYSIS_VERSION);
		if (!analysis) throw new NotFoundException("This Trip has not been analysed yet");
		const events = await this.repository.findEvents({
			analysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
			tripId,
			limit: ROUTE_DEVIATION_EVENTS_MAX_LIMIT,
		});
		return { analysis, events };
	}

	listEvents(filter: {
		tripId?: string;
		routeId?: string;
		authoritative?: boolean;
		limit?: number;
	}): Promise<RouteDeviationEventRow[]> {
		const limit = Math.min(
			Math.max(Math.trunc(filter.limit ?? ROUTE_DEVIATION_EVENTS_DEFAULT_LIMIT), 1),
			ROUTE_DEVIATION_EVENTS_MAX_LIMIT
		);
		return this.repository.findEvents({
			...filter,
			analysisVersion: ROUTE_DEVIATION_ANALYSIS_VERSION,
			limit,
		});
	}

	/** The role recorded on the log decides which participation rule applies. */
	private async resolveParticipant(
		tripId: string,
		userId: string,
		role: GpsParticipantRole
	): Promise<Participant | null> {
		if (role === GpsParticipantRole.CAMPER) {
			const camper = await this.participation.findCamperParticipation(tripId, userId);
			return camper ? { role: GpsParticipantRole.CAMPER, camper } : null;
		}
		const porter = await this.participation.findPorterAssignment(tripId, userId);
		return porter ? { role: GpsParticipantRole.PORTER, assigned: porter.assigned } : null;
	}

	/** BR-362: same participation window as live uploads (CTMS-059). */
	private exclusion(
		trip: AnalysisTrip,
		participant: Participant | null,
		sample: StoredGpsSample
	): RouteDeviationExclusionReason | null {
		if (!participant) return RouteDeviationExclusionReason.PARTICIPATION_NOT_ELIGIBLE;
		const rejection = participationRejection(
			{
				id: trip.id,
				status: trip.status,
				startsAt: new Date(trip.startsAt),
				endsAt: new Date(trip.endsAt),
				updatedAt: new Date(trip.updatedAt),
			},
			participant,
			sample.eventTime.toISOString()
		);
		if (rejection === null) return null;
		return rejection === GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION
			? RouteDeviationExclusionReason.OUTSIDE_PARTICIPATION
			: RouteDeviationExclusionReason.PARTICIPATION_NOT_ELIGIBLE;
	}
}

function toReplaySample(sample: StoredGpsSample): ReplaySample {
	return {
		id: sample.id,
		eventTime: sample.eventTime,
		accuracyMeters: sample.accuracyMeters,
		distanceMeters: sample.distanceMeters,
		lng: sample.lng,
		lat: sample.lat,
		routeFraction: sample.routeFraction,
		packageVersion: sample.packageVersion,
	};
}

/**
 * BR-360 / BR-363: the package in effect comes from the logs themselves, else the Trip's offline
 * package at departure. Missing or mixed versions keep the episode out of authoritative evidence.
 */
export function packageContext(
	logVersions: string[],
	trip: Pick<AnalysisTrip, "offlinePackageVersion">
): { packageVersion: string | null; issues: RouteDeviationContextIssue[] } {
	if (logVersions.length > 1) {
		return {
			packageVersion: logVersions[0],
			issues: [RouteDeviationContextIssue.PACKAGE_VERSION_INCONSISTENT],
		};
	}
	const packageVersion = logVersions[0] ?? trip.offlinePackageVersion ?? null;
	return packageVersion
		? { packageVersion, issues: [] }
		: { packageVersion: null, issues: [RouteDeviationContextIssue.PACKAGE_VERSION_MISSING] };
}
