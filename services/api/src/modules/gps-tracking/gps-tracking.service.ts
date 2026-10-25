import { Injectable } from "@nestjs/common";
import type { CreateGpsLogsDto, GpsLogInputDto } from "./dto/create-gps-logs.dto";
import type {
	GpsLogIngestResponseDto,
	GpsLogIngestResultDto,
	GpsTrackingContextResponseDto,
} from "./dto/gps-tracking-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { GpsLogRepository, type NewGpsLog } from "./gps-log.repository";
import {
	liveIneligibilityReason,
	participationRejection,
	resolveTripParticipant,
} from "./gps-participant";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { GpsParticipationSource } from "./gps-participation.source";
import {
	GPS_LOGGING_INTERVAL_SECONDS,
	GPS_SAMPLING_INTERVAL_SECONDS,
	GPS_TRACKING_CONFIG_VERSION,
} from "./gps-tracking.constants";
import {
	GpsLogIngestStatus,
	GpsLogRejectionReason,
	type GpsParticipantRole,
} from "./gps-tracking.enums";

@Injectable()
export class GpsTrackingService {
	constructor(
		private readonly participation: GpsParticipationSource,
		private readonly gpsLogs: GpsLogRepository
	) {}

	/** BR-237 live check: may the caller record breadcrumbs for this Trip right now? */
	async getTrackingContext(userId: string, tripId: string): Promise<GpsTrackingContextResponseDto> {
		const { trip, participant } = await resolveTripParticipant(this.participation, userId, tripId);
		const reason = liveIneligibilityReason(trip, participant);
		return {
			tripId,
			eligible: reason === null,
			reason,
			participantRole: participant.role,
			samplingIntervalSeconds: GPS_SAMPLING_INTERVAL_SECONDS,
			loggingIntervalSeconds: GPS_LOGGING_INTERVAL_SECONDS,
			configVersion: GPS_TRACKING_CONFIG_VERSION,
		};
	}

	/**
	 * Accepts synchronized breadcrumbs idempotently (BR-244). Each log gets its own
	 * outcome so one invalid log never blocks the rest of the client's buffer.
	 */
	async ingestLogs(
		userId: string,
		tripId: string,
		dto: CreateGpsLogsDto
	): Promise<GpsLogIngestResponseDto> {
		const { trip, participant } = await resolveTripParticipant(this.participation, userId, tripId);
		const outcomeById = new Map<string, GpsLogIngestResultDto>();
		const candidates: NewGpsLog[] = [];
		const seenIds = new Set<string>();

		for (const log of dto.logs) {
			// A UUID repeated inside one batch is evaluated once and shares that outcome.
			if (seenIds.has(log.id)) {
				continue;
			}
			seenIds.add(log.id);
			const rejection = participationRejection(trip, participant, log.eventTime);
			if (rejection) {
				outcomeById.set(log.id, rejected(log.id, rejection));
				continue;
			}
			candidates.push(toNewGpsLog(log, tripId, userId, participant.role));
		}

		const insertedIds = await this.gpsLogs.insertIgnoringExisting(candidates);
		const existingIds = candidates.map((log) => log.id).filter((id) => !insertedIds.has(id));
		const owners = await this.gpsLogs.findOwners(existingIds);

		for (const log of candidates) {
			if (insertedIds.has(log.id)) {
				outcomeById.set(log.id, { id: log.id, status: GpsLogIngestStatus.ACCEPTED, reason: null });
				continue;
			}
			const owner = owners.get(log.id);
			const isOwnRetry = owner?.userId === userId && owner.tripId === tripId;
			outcomeById.set(
				log.id,
				isOwnRetry
					? { id: log.id, status: GpsLogIngestStatus.DUPLICATE, reason: null }
					: rejected(log.id, GpsLogRejectionReason.ID_CONFLICT)
			);
		}

		return { results: dto.logs.map((log) => outcomeById.get(log.id) as GpsLogIngestResultDto) };
	}
}

function rejected(id: string, reason: GpsLogRejectionReason): GpsLogIngestResultDto {
	return { id, status: GpsLogIngestStatus.REJECTED, reason };
}

function toNewGpsLog(
	log: GpsLogInputDto,
	tripId: string,
	userId: string,
	participantRole: GpsParticipantRole
): NewGpsLog {
	return {
		id: log.id,
		tripId,
		userId,
		participantRole,
		eventTime: log.eventTime,
		latitude: log.latitude,
		longitude: log.longitude,
		accuracyMeters: log.accuracyMeters,
		altitudeMeters: log.altitudeMeters ?? null,
		batteryLevel: log.batteryLevel ?? null,
		packageVersion: log.packageVersion ?? null,
		configVersion: log.configVersion,
	};
}
