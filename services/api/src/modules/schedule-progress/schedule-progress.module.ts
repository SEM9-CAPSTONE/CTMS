import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { ScheduleProgressController } from "./schedule-progress.controller";
import { ScheduleProgressRepository } from "./schedule-progress.repository";
import { ScheduleProgressService } from "./schedule-progress.service";

/** CTMS-063 (Jira CTMS-319): new read-only module, per the leader's request not to touch trips/route code. */
@Module({
	imports: [GpsTrackingModule],
	controllers: [ScheduleProgressController],
	providers: [ScheduleProgressService, ScheduleProgressRepository, JwtAuthGuard, RolesGuard],
	exports: [ScheduleProgressService],
})
export class ScheduleProgressModule {}
