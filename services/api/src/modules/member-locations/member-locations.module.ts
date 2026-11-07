import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScheduleProgressModule } from "../schedule-progress/schedule-progress.module";
import { MemberLocationsController } from "./member-locations.controller";
import { MemberLocationsRepository } from "./member-locations.repository";
import { MemberLocationsService } from "./member-locations.service";

/** CTMS-066 (Jira CTMS-329): new read-only module; CTMS-369's host-trip-map is left unchanged. */
@Module({
	imports: [ScheduleProgressModule],
	controllers: [MemberLocationsController],
	providers: [MemberLocationsService, MemberLocationsRepository, JwtAuthGuard, RolesGuard],
})
export class MemberLocationsModule {}
