import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RevenueAnalyticsModule } from "../revenue-analytics/revenue-analytics.module";
import { WeatherModule } from "../weather/weather.module";
import { HostAnalyticsAiProvider } from "./host-analytics-ai.provider";
import { HostAnalyticsSuggestionsService } from "./host-analytics-suggestions.service";
import { HostAnalyticsSuggestionsWorker } from "./host-analytics-suggestions.worker";
import { HostAnalyticsWeatherService } from "./host-analytics-weather.service";
import { HostAnalyticsController } from "./host-analytics.controller";
import { HostAnalyticsRepository } from "./host-analytics.repository";
import { HostAnalyticsService } from "./host-analytics.service";

@Module({
	imports: [AuthModule, RevenueAnalyticsModule, WeatherModule],
	controllers: [HostAnalyticsController],
	providers: [
		HostAnalyticsRepository,
		HostAnalyticsService,
		HostAnalyticsWeatherService,
		HostAnalyticsAiProvider,
		HostAnalyticsSuggestionsService,
		HostAnalyticsSuggestionsWorker,
	],
	exports: [HostAnalyticsService, HostAnalyticsSuggestionsService],
})
export class HostAnalyticsModule {}
