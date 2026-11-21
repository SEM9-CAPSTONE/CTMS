import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { InAppNotificationsModule } from "../in-app-notifications/in-app-notifications.module";
import { TripReviewAnalyticsHostController } from "./trip-review-analytics-host.controller";
import { TripReviewAnalyticsHostService } from "./trip-review-analytics-host.service";
import { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import { TripReviewModerationHostController } from "./trip-review-moderation-host.controller";
import { TripReviewModerationHostService } from "./trip-review-moderation-host.service";
import { TripReviewModerationOutboxService } from "./trip-review-moderation-outbox.service";
import { TripReviewModerationProvider } from "./trip-review-moderation.provider";
import { TripReviewModerationWorker } from "./trip-review-moderation.worker";

@Module({
	imports: [ConfigModule, InAppNotificationsModule],
	controllers: [TripReviewModerationHostController, TripReviewAnalyticsHostController],
	providers: [
		TripReviewImageStorageService,
		TripReviewModerationHostService,
		TripReviewAnalyticsHostService,
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
	exports: [
		TripReviewImageStorageService,
		TripReviewModerationHostService,
		TripReviewAnalyticsHostService,
		TripReviewModerationOutboxService,
		TripReviewModerationProvider,
		TripReviewModerationWorker,
	],
})
export class TripReviewModerationModule {}
