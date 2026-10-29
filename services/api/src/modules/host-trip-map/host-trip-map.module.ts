import { Module } from "@nestjs/common";
import { HostTripMapController } from "./host-trip-map.controller";
import { HostTripMapRepository } from "./host-trip-map.repository";
import { HostTripMapService } from "./host-trip-map.service";

@Module({
	controllers: [HostTripMapController],
	providers: [HostTripMapRepository, HostTripMapService],
})
export class HostTripMapModule {}
