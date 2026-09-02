import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WeatherController } from "./controllers/weather.controller";
import { WeatherAdvice } from "./entities/weather-advice.entity";
import { WeatherRiskAssessment } from "./entities/weather-risk-assessment.entity";
import { WeatherSnapshot } from "./entities/weather-snapshot.entity";
import { HttpWeatherAdviceProvider } from "./providers/http-weather-advice.provider";
import { OpenMeteoWeatherProvider } from "./providers/open-meteo-weather.provider";
import { WEATHER_ADVICE_PROVIDER } from "./providers/weather-advice-provider.interface";
import { WEATHER_PROVIDER } from "./providers/weather-provider.interface";
import { WeatherAdviceRepository } from "./repositories/weather-advice.repository";
import { WeatherRiskRepository } from "./repositories/weather-risk.repository";
import { WeatherSnapshotsRepository } from "./repositories/weather-snapshots.repository";
import { WeatherAdviceService } from "./services/weather-advice.service";
import { WeatherRiskService } from "./services/weather-risk.service";
import { WeatherService } from "./services/weather.service";

@Module({
	controllers: [WeatherController],
	providers: [
		WeatherService,
		WeatherRiskService,
		WeatherAdviceService,
		JwtAuthGuard,
		RolesGuard,
		{ provide: WEATHER_PROVIDER, useClass: OpenMeteoWeatherProvider },
		{ provide: WEATHER_ADVICE_PROVIDER, useClass: HttpWeatherAdviceProvider },
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
			provide: WeatherAdviceRepository,
			useFactory: (dataSource: DataSource) =>
				new WeatherAdviceRepository(WeatherAdvice, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class WeatherModule {}
