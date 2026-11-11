import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RealtimeModule } from "../realtime/realtime.module";
import { EmergencyBroadcastsController } from "./emergency-broadcasts.controller";
import { EmergencyBroadcastsRepository } from "./emergency-broadcasts.repository";
import { EmergencyBroadcastsService } from "./emergency-broadcasts.service";

/** CTMS-081 (Jira CTMS-361): new module; SOS and Trip modules are left unchanged. */
@Module({
	imports: [RealtimeModule],
	controllers: [EmergencyBroadcastsController],
	providers: [EmergencyBroadcastsService, EmergencyBroadcastsRepository, JwtAuthGuard, RolesGuard],
})
export class EmergencyBroadcastsModule {}
