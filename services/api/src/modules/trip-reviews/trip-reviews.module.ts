import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TripReviewsController } from "./trip-reviews.controller";
import { TripReviewsRepository } from "./trip-reviews.repository";
import { TripReviewsService } from "./trip-reviews.service";

@Module({
	controllers: [TripReviewsController],
	providers: [TripReviewsService, TripReviewsRepository, JwtAuthGuard, RolesGuard],
})
export class TripReviewsModule {}
