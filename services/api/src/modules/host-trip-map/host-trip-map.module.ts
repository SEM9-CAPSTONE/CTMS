import { Module } from "@nestjs/common";
import { ScheduleProgressModule } from "../schedule-progress/schedule-progress.module";
import { HostTripMapController } from "./host-trip-map.controller";
import { HostTripMapRepository } from "./host-trip-map.repository";
import { HostTripMapService } from "./host-trip-map.service";

@Module({
	imports: [ScheduleProgressModule],
	controllers: [HostTripMapController],
	providers: [HostTripMapRepository, HostTripMapService],
})
export class HostTripMapModule {}
