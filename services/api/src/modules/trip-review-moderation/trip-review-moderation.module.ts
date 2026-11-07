import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TripReviewModerationOutboxService } from "./trip-review-moderation-outbox.service";
import { TripReviewModerationProvider } from "./trip-review-moderation.provider";
import { TripReviewModerationWorker } from "./trip-review-moderation.worker";

@Module({
	imports: [ConfigModule],
	providers: [
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
	exports: [
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
})
export class TripReviewModerationModule {}
