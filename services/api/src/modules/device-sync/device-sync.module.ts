import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { DeviceSyncController } from "./device-sync.controller";
import { DeviceSyncRepository } from "./device-sync.repository";
import { DeviceSyncService } from "./device-sync.service";

@Module({
	controllers: [DeviceSyncController],
	providers: [
		DeviceSyncService,
		DeviceSyncRepository,
		GpsParticipationSource,
		JwtAuthGuard,
		RolesGuard,
	],
	exports: [DeviceSyncService, DeviceSyncRepository],
})
export class DeviceSyncModule {}
