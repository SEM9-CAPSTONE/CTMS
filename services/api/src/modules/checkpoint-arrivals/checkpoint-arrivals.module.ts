import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CheckpointArrivalsController } from "./checkpoint-arrivals.controller";
import { CheckpointArrivalsRepository } from "./checkpoint-arrivals.repository";
import { CheckpointArrivalsService } from "./checkpoint-arrivals.service";

@Module({
	controllers: [CheckpointArrivalsController],
	providers: [CheckpointArrivalsRepository, CheckpointArrivalsService, JwtAuthGuard, RolesGuard],
	exports: [CheckpointArrivalsRepository],
})
export class CheckpointArrivalsModule {}
