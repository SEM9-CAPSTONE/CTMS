import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RealtimeModule } from "../realtime/realtime.module";
import { RouteRegistrationRiskController } from "./controllers/route-registration-risk.controller";
import { TripWeatherForecastController } from "./controllers/trip-weather-forecast.controller";
import { WeatherAiReviewController } from "./controllers/weather-ai-review.controller";
import { WeatherChangeNoticesController } from "./controllers/weather-change-notices.controller";
import { WeatherRiskRulesController } from "./controllers/weather-risk-rules.controller";
import { WeatherController } from "./controllers/weather.controller";
import { TripWeatherForecast } from "./entities/trip-weather-forecast.entity";
import { WeatherAdvice } from "./entities/weather-advice.entity";
import { WeatherRiskAssessment } from "./entities/weather-risk-assessment.entity";
import { WeatherSnapshot } from "./entities/weather-snapshot.entity";
import { HttpWeatherAdviceProvider } from "./providers/http-weather-advice.provider";
import { OpenMeteoWeatherProvider } from "./providers/open-meteo-weather.provider";
import { WEATHER_ADVICE_PROVIDER } from "./providers/weather-advice-provider.interface";
import { WEATHER_PROVIDER } from "./providers/weather-provider.interface";
import {
	HttpWeatherRiskReviewProvider,
	WEATHER_RISK_REVIEW_PROVIDER,
} from "./providers/weather-risk-review.provider";
import { TripWeatherChangeNoticesRepository } from "./repositories/trip-weather-change-notices.repository";
import { TripWeatherForecastsRepository } from "./repositories/trip-weather-forecasts.repository";
import { WeatherAdviceRepository } from "./repositories/weather-advice.repository";
import { WeatherRiskRepository } from "./repositories/weather-risk.repository";
import { WeatherSnapshotsRepository } from "./repositories/weather-snapshots.repository";
import { RouteRegistrationRiskService } from "./services/route-registration-risk.service";
import { TripWeatherAiReviewService } from "./services/trip-weather-ai-review.service";
import { TripWeatherChangeNotifier } from "./services/trip-weather-change-notifier.service";
import { TripWeatherForecastService } from "./services/trip-weather-forecast.service";
import { TripWeatherMonitorService } from "./services/trip-weather-monitor.service";
import { TripWeatherMonitorWorker } from "./services/trip-weather-monitor.worker";
import { WeatherAdviceService } from "./services/weather-advice.service";
import { WeatherRiskRulesService } from "./services/weather-risk-rules.service";
import { WeatherRiskService } from "./services/weather-risk.service";
import { WeatherService } from "./services/weather.service";

@Module({
	// CTMS-93: level-change notices are pushed to each recipient's private socket room.
	imports: [RealtimeModule],
	controllers: [
		WeatherController,
		RouteRegistrationRiskController,
		WeatherRiskRulesController,
		TripWeatherForecastController,
		WeatherChangeNoticesController,
		WeatherAiReviewController,
	],
	providers: [
		WeatherService,
		WeatherRiskService,
		WeatherAdviceService,
		WeatherRiskRulesService,
		TripWeatherForecastService,
		TripWeatherChangeNoticesRepository,
		TripWeatherChangeNotifier,
		TripWeatherMonitorService,
		TripWeatherMonitorWorker,
		TripWeatherAiReviewService,
		{
			provide: RouteRegistrationRiskService,
			useFactory: (
				weatherRiskRepository: WeatherRiskRepository,
				weatherSnapshotsRepository: WeatherSnapshotsRepository,
				dataSource: DataSource
			) =>
				new RouteRegistrationRiskService(
					weatherRiskRepository,
					weatherSnapshotsRepository,
					dataSource
				),
			inject: [WeatherRiskRepository, WeatherSnapshotsRepository, DataSource],
		},
		JwtAuthGuard,
		RolesGuard,
		{ provide: WEATHER_PROVIDER, useClass: OpenMeteoWeatherProvider },
		{ provide: WEATHER_ADVICE_PROVIDER, useClass: HttpWeatherAdviceProvider },
		{ provide: WEATHER_RISK_REVIEW_PROVIDER, useClass: HttpWeatherRiskReviewProvider },
		{
			provide: WeatherSnapshotsRepository,
			useFactory: (dataSource: DataSource) =>
				new WeatherSnapshotsRepository(WeatherSnapshot, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: WeatherRiskRepository,
			useFactory: (dataSource: DataSource) =>
				new WeatherRiskRepository(WeatherRiskAssessment, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: TripWeatherForecastsRepository,
			useFactory: (dataSource: DataSource) =>
				new TripWeatherForecastsRepository(TripWeatherForecast, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: WeatherAdviceRepository,
			useFactory: (dataSource: DataSource) =>
				new WeatherAdviceRepository(WeatherAdvice, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
	exports: [RouteRegistrationRiskService, WeatherRiskRepository, TripWeatherForecastService],
})
export class WeatherModule {}
