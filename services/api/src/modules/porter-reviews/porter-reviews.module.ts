import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PorterReviewsController } from "./porter-reviews.controller";
import { PorterReviewsRepository } from "./porter-reviews.repository";
import { PorterReviewsService } from "./porter-reviews.service";

@Module({
	controllers: [PorterReviewsController],
	providers: [PorterReviewsService, PorterReviewsRepository, JwtAuthGuard, RolesGuard],
	exports: [PorterReviewsRepository],
})
export class PorterReviewsModule {}
