import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { GpsLogRepository } from "./gps-log.repository";
import { GpsParticipationSource } from "./gps-participation.source";
import { GpsTrackingController } from "./gps-tracking.controller";
import { GpsTrackingService } from "./gps-tracking.service";

@Module({
	controllers: [GpsTrackingController],
	providers: [
		GpsTrackingService,
		GpsParticipationSource,
		GpsLogRepository,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class GpsTrackingModule {}
