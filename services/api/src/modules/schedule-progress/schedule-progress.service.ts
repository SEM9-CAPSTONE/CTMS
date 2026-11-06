import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import {
	BEHIND_LAG_MINUTES,
	LOCATION_UNKNOWN_AFTER_MINUTES,
	SCHEDULE_PROGRESS_CONFIG_VERSION,
	SEVERELY_BEHIND_LAG_MINUTES,
} from "./schedule-progress.constants";
import {
	BehindScheduleLevel,
	type CamperScheduleProgress,
	evaluateCamper,
} from "./schedule-progress.evaluator";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import {
	type NewBehindScheduleWarning,
	ScheduleProgressRepository,
	type TripCamper,
} from "./schedule-progress.repository";

export type ScheduleProgressViewer = "camper" | "team";

export interface ScheduleProgressResult {
	tripId: string;
	tripStatus: string;
	evaluatedAt: Date;
	viewer: ScheduleProgressViewer;
	configVersion: string;
	thresholds: {
		behindLagMinutes: number;
		severelyBehindLagMinutes: number;
		locationUnknownAfterMinutes: number;
	};
	members: Array<CamperScheduleProgress & { fullName: string | null }>;
}

const MINUTE_MS = 60_000;

/**
 * CTMS-063 (Jira CTMS-319): "lagging behind the Porter" evaluation (spec §13).
 * Read-only over Porter confirmations, Camper GPS and checkpoints; the only write is the idempotent
 * `BEHIND_SCHEDULE` record of each level reached.
 */
@Injectable()
export class ScheduleProgressService {
	constructor(
		private readonly repository: ScheduleProgressRepository,
		private readonly participation: GpsParticipationSource
	) {}

	/** Evaluation clock; a seam for tests. */
	now(): Date {
		return new Date();
	}

	async getProgress(userId: string, tripId: string): Promise<ScheduleProgressResult> {
		const trip = await this.repository.findTrip(tripId);
		if (!trip) throw new NotFoundException("Trip not found");
		const viewer = await this.resolveViewer(userId, tripId, trip.hostId);
		const now = this.now();

		const result: ScheduleProgressResult = {
			tripId,
			tripStatus: trip.status,
			evaluatedAt: now,
			viewer,
			configVersion: SCHEDULE_PROGRESS_CONFIG_VERSION,
			thresholds: {
				behindLagMinutes: BEHIND_LAG_MINUTES,
				severelyBehindLagMinutes: SEVERELY_BEHIND_LAG_MINUTES,
				locationUnknownAfterMinutes: LOCATION_UNKNOWN_AFTER_MINUTES,
			},
			members: [],
		};
		// Lagging behind the group is only meaningful while the Trip is running.
		if (trip.status !== "ongoing") return result;

		const allCampers = await this.repository.findJoinedCampers(tripId);
		const campers: TripCamper[] =
			viewer === "camper" ? allCampers.filter((camper) => camper.userId === userId) : allCampers;
		if (campers.length === 0) return result;

		const [checkpoints, baselines] = await Promise.all([
			this.repository.findCheckpoints(trip.routeId),
			this.repository.findPorterBaselines(tripId),
		]);
		const userIds = campers.map((camper) => camper.userId);
		const [passed, samples] = await Promise.all([
			this.repository.findPassedCheckpoints(tripId, trip.routeId, userIds, [...baselines.keys()]),
			this.repository.findLastValidSamples(tripId, trip.routeId, userIds),
		]);

		const warnings: NewBehindScheduleWarning[] = [];
		for (const camper of campers) {
			const sample = samples.get(camper.userId) ?? null;
			const progress = evaluateCamper({
				camper: {
					userId: camper.userId,
					passedCheckpointIds: passed.get(camper.userId) ?? new Set(),
					lastValidSample: sample,
				},
				checkpoints,
				porterBaselines: baselines,
				now,
			});
			result.members.push({ ...progress, fullName: camper.fullName });
			if (!progress.reference) continue;
			for (const level of progress.levelsReached) {
				const lag =
					level === BehindScheduleLevel.SEVERELY_BEHIND
						? SEVERELY_BEHIND_LAG_MINUTES
						: BEHIND_LAG_MINUTES;
				warnings.push({
					tripId,
					userId: camper.userId,
					checkpointId: progress.reference.checkpointId,
					level,
					// The moment the level was reached, so re-evaluations describe the same warning.
					eventTime: new Date(progress.reference.porterArrivedAt.getTime() + lag * MINUTE_MS),
					routeId: trip.routeId,
					routeVersion: trip.routeVersion,
					sample,
				});
			}
		}
		await this.repository.recordWarnings(warnings);
		return result;
	}

	/** §13.5: a Camper sees only themselves; the Trip Host and assigned Porters see every Camper. */
	private async resolveViewer(
		userId: string,
		tripId: string,
		hostId: string
	): Promise<ScheduleProgressViewer> {
		if (hostId === userId) return "team";
		const [porter, camper] = await Promise.all([
			this.participation.findPorterAssignment(tripId, userId),
			this.participation.findCamperParticipation(tripId, userId),
		]);
		if (porter?.assigned) return "team";
		if (camper) return "camper";
		throw new ForbiddenException("You are not a participant of this Trip");
	}
}
