import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RevenueAnalyticsController } from "./revenue-analytics.controller";
import { RevenueAnalyticsRepository } from "./revenue-analytics.repository";
import { RevenueAnalyticsService } from "./revenue-analytics.service";

@Module({
	imports: [AuthModule],
	controllers: [RevenueAnalyticsController],
	providers: [RevenueAnalyticsRepository, RevenueAnalyticsService],
	exports: [RevenueAnalyticsService],
})
export class RevenueAnalyticsModule {}
