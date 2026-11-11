import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripsRepository } from "../repositories/trips.repository";

export interface TripStatusAdvanceResult {
	started: number;
	completed: number;
}

/**
 * Keeps stored Trip status in step with the schedule: a published Trip becomes `ongoing` at
 * `startsAt` and `completed` at `endsAt` (directly, if the worker was down for the whole Trip).
 */
@Injectable()
export class TripStatusScheduleService {
	private readonly logger = new Logger(TripStatusScheduleService.name);

	constructor(
		private readonly tripsRepository: TripsRepository,
		private readonly configService: ConfigService
	) {}

	async advanceDueTrips(batchSize: number): Promise<TripStatusAdvanceResult> {
		// When auto-cancel runs, let it evaluate participation before a Trip can start or finish.
		const awaitParticipationEvaluation =
			this.configService.get<string>("TRIP_AUTO_CANCEL_WORKER_ENABLED")?.trim().toLowerCase() ===
			"true";
		const completed = await this.tripsRepository.advanceTripStatusesByTime(
			TripStatus.COMPLETED,
			batchSize,
			awaitParticipationEvaluation
		);
		const started = await this.tripsRepository.advanceTripStatusesByTime(
			TripStatus.ONGOING,
			batchSize,
			awaitParticipationEvaluation
		);
		if (started.length > 0 || completed.length > 0)
			this.logger.log(
				`Advanced Trip status by schedule: ${started.length} ongoing, ${completed.length} completed`
			);
		return { started: started.length, completed: completed.length };
	}
}
