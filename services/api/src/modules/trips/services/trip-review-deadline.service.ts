import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { TripsService } from "./trips.service";

const TRIP_REVIEW_DEADLINE_INTERVAL_MS = 60 * 1000;

@Injectable()
export class TripReviewDeadlineService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TripReviewDeadlineService.name);
	private timer: NodeJS.Timeout | null = null;

	constructor(private readonly tripsService: TripsService) {}

	onModuleInit() {
		this.timer = setInterval(() => {
			void this.runOnce();
		}, TRIP_REVIEW_DEADLINE_INTERVAL_MS);
		void this.runOnce();
	}

	onModuleDestroy() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	async runOnce(now = new Date()): Promise<void> {
		try {
			const result = await this.tripsService.processPendingReviewDeadlines(now);
			if (result.reminded || result.rejected) {
				this.logger.log(
					`Processed Trip review deadlines: reminded=${result.reminded}, rejected=${result.rejected}`
				);
			}
		} catch (error) {
			this.logger.error("Failed to process Trip review deadlines", error);
		}
	}
}
