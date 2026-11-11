import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ScheduleProgressService } from "../schedule-progress/schedule-progress.service";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { MemberLocationsRepository } from "./member-locations.repository";
import {
	type BehindScheduleFlag,
	LocationFreshness,
	type MemberLocation,
	type MemberLocationRow,
	type TripMemberLocations,
} from "./member-locations.types";

/** Same approved display threshold as the Host map (CTMS-369); no second configuration value. */
const FRESHNESS_ENV = "HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS";
const DEFAULT_FRESHNESS_MAX_AGE_SECONDS = 120;
const MS_PER_SECOND = 1000;

/** CTMS-066 (Jira CTMS-329): each eligible member's last server-confirmed location and safety context. */
@Injectable()
export class MemberLocationsService {
	private readonly maxAge: number;

	constructor(
		private readonly repository: MemberLocationsRepository,
		private readonly scheduleProgress: ScheduleProgressService,
		config: ConfigService
	) {
		this.maxAge = Number(config.get<string>(FRESHNESS_ENV) ?? DEFAULT_FRESHNESS_MAX_AGE_SECONDS);
		if (!Number.isSafeInteger(this.maxAge) || this.maxAge <= 0) {
			throw new Error(`${FRESHNESS_ENV} must be a positive safe integer`);
		}
	}

	/** Projection clock; a seam for tests. */
	now(): Date {
		return new Date();
	}

	async getMemberLocations(userId: string, tripId: string): Promise<TripMemberLocations> {
		const trip = await this.repository.findTrip(tripId);
		// BR-172/173: outside the Host's or assigned Porter's scope the Trip is indistinguishable from absent.
		let viewer: TripMemberLocations["viewer"] | null = null;
		if (trip?.hostId === userId) viewer = "host";
		else if (trip && (await this.repository.isAssignedPorter(tripId, userId))) viewer = "porter";
		if (!trip || !viewer) throw new NotFoundException("Trip not found");
		if (trip.status !== "ongoing") {
			throw new ConflictException("Member locations are only available while the Trip is ongoing");
		}

		const [rows, progress] = await Promise.all([
			this.repository.findMembers(tripId),
			this.scheduleProgress.getProgress(userId, tripId),
		]);
		const evaluatedAt = progress.evaluatedAt.toISOString();
		const behind = new Map<string, BehindScheduleFlag>(
			progress.members.map((member) => [
				member.userId,
				{
					status: member.status,
					lagMinutes: member.lagMinutes,
					reference: member.reference
						? {
								checkpointId: member.reference.checkpointId,
								checkpointName: member.reference.checkpointName,
								porterArrivedAt: member.reference.porterArrivedAt.toISOString(),
							}
						: null,
					safeCheckpoint: member.safeCheckpoint,
					evaluatedAt,
				},
			])
		);

		const now = this.now();
		return {
			tripId,
			tripStatus: trip.status,
			viewer,
			generatedAt: now.toISOString(),
			locationSource: "server_confirmed",
			freshnessMaxAgeSeconds: this.maxAge,
			members: rows.map((row) => this.project(row, now, behind)),
		};
	}

	private project(
		row: MemberLocationRow,
		now: Date,
		behind: Map<string, BehindScheduleFlag>
	): MemberLocation {
		const location = row.location;
		const age = location ? (now.getTime() - Date.parse(location.eventTime)) / MS_PER_SECOND : null;
		let freshness = LocationFreshness.UNAVAILABLE;
		if (age !== null) {
			// A future-dated capture is never described as fresh.
			freshness =
				age >= 0 && age <= this.maxAge ? LocationFreshness.FRESH : LocationFreshness.STALE;
		}
		const lastSyncedAt = row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null;
		return {
			id: row.id,
			userId: row.userId,
			name: row.name,
			role: row.role,
			memberStatus: row.memberStatus,
			location,
			lastSeenAt: location?.eventTime ?? null,
			lastSyncedAt,
			freshness,
			locationAgeSeconds: age === null ? null : Math.max(0, Math.floor(age)),
			safety: {
				route: row.route,
				gps: row.gps,
				lastCheckpoint: row.lastCheckpoint,
				behindSchedule:
					row.role === GpsParticipantRole.CAMPER && row.userId
						? (behind.get(row.userId) ?? null)
						: null,
			},
		};
	}
}
