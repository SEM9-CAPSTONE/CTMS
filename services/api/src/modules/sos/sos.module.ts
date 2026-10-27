import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { SosAlertsRepository } from "./sos-alerts.repository";
import { SosController } from "./sos.controller";
import { SosService } from "./sos.service";

@Module({
	imports: [GpsTrackingModule, RealtimeModule],
	controllers: [SosController],
	providers: [SosService, SosAlertsRepository, JwtAuthGuard, RolesGuard],
	exports: [SosService, SosAlertsRepository],
})
export class SosModule {}
