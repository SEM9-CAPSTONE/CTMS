import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { SafetyEventRepository } from "./safety-event.repository";
import { SafetyEventsController } from "./safety-events.controller";
import { SafetyEventsService } from "./safety-events.service";

@Module({
	imports: [GpsTrackingModule],
	controllers: [SafetyEventsController],
	providers: [SafetyEventsService, SafetyEventRepository, JwtAuthGuard, RolesGuard],
})
export class SafetyEventsModule {}
