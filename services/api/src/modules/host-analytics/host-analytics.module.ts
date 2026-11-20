import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RevenueAnalyticsModule } from "../revenue-analytics/revenue-analytics.module";
import { HostAnalyticsController } from "./host-analytics.controller";
import { HostAnalyticsRepository } from "./host-analytics.repository";
import { HostAnalyticsService } from "./host-analytics.service";

@Module({
	imports: [AuthModule, RevenueAnalyticsModule],
	controllers: [HostAnalyticsController],
	providers: [HostAnalyticsRepository, HostAnalyticsService],
	exports: [HostAnalyticsService],
})
export class HostAnalyticsModule {}
