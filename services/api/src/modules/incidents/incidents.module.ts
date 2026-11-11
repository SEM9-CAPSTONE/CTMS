import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RealtimeModule } from "../realtime/realtime.module";
import { IncidentMediaStorage } from "./incident-media.storage";
import { IncidentsController } from "./incidents.controller";
import { IncidentsRepository } from "./incidents.repository";
import { IncidentsService } from "./incidents.service";

@Module({
	imports: [RealtimeModule],
	controllers: [IncidentsController],
	providers: [
		IncidentsService,
		IncidentsRepository,
		IncidentMediaStorage,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class IncidentsModule {}
