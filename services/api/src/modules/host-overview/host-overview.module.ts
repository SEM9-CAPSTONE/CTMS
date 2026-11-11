import { Module } from "@nestjs/common";
import { HostOverviewController } from "./host-overview.controller";
import { HostOverviewRepository } from "./host-overview.repository";
import { HostOverviewService } from "./host-overview.service";

@Module({
	controllers: [HostOverviewController],
	providers: [HostOverviewRepository, HostOverviewService],
})
export class HostOverviewModule {}
