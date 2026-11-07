import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import { TripReviewModerationHostController } from "./trip-review-moderation-host.controller";
import { TripReviewModerationHostService } from "./trip-review-moderation-host.service";
import { TripReviewModerationOutboxService } from "./trip-review-moderation-outbox.service";
import { TripReviewModerationProvider } from "./trip-review-moderation.provider";
import { TripReviewModerationWorker } from "./trip-review-moderation.worker";

@Module({
	imports: [ConfigModule],
	controllers: [TripReviewModerationHostController],
	providers: [
		TripReviewImageStorageService,
		TripReviewModerationHostService,
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
	exports: [
		TripReviewImageStorageService,
		TripReviewModerationHostService,
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
})
export class TripReviewModerationModule {}
