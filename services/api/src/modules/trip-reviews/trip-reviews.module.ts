import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TripReviewModerationModule } from "../trip-review-moderation/trip-review-moderation.module";
import { UploadsModule } from "../uploads/uploads.module";
import { TripReviewImagesController } from "./trip-review-images.controller";
import { TripReviewImagesService } from "./trip-review-images.service";
import { TripReviewsController } from "./trip-reviews.controller";
import { TripReviewsRepository } from "./trip-reviews.repository";
import { TripReviewsService } from "./trip-reviews.service";

@Module({
	imports: [UploadsModule, TripReviewModerationModule],
	controllers: [TripReviewsController, TripReviewImagesController],
	providers: [
		TripReviewImagesService,
		TripReviewsService,
		TripReviewsRepository,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class TripReviewsModule {}
