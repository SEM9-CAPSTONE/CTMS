import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WeatherController } from "./controllers/weather.controller";
import { WeatherSnapshot } from "./entities/weather-snapshot.entity";
import { OpenMeteoWeatherProvider } from "./providers/open-meteo-weather.provider";
import { WEATHER_PROVIDER } from "./providers/weather-provider.interface";
import { WeatherSnapshotsRepository } from "./repositories/weather-snapshots.repository";
import { WeatherService } from "./services/weather.service";

@Module({
	controllers: [WeatherController],
	providers: [
		WeatherService,
		JwtAuthGuard,
		RolesGuard,
		{ provide: WEATHER_PROVIDER, useClass: OpenMeteoWeatherProvider },
		{
			provide: WeatherSnapshotsRepository,
			useFactory: (dataSource: DataSource) =>
				new WeatherSnapshotsRepository(WeatherSnapshot, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class WeatherModule {}
