import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TripsModule } from "../trips/trips.module";
import { WeatherModule } from "../weather/weather.module";
import { TripRecommendationsController } from "./trip-recommendations.controller";
import { TripRecommendationsProvider } from "./trip-recommendations.provider";
import { TripRecommendationsRepository } from "./trip-recommendations.repository";
import { TripRecommendationsService } from "./trip-recommendations.service";

@Module({
	imports: [TripsModule, WeatherModule],
	controllers: [TripRecommendationsController],
	providers: [
		TripRecommendationsProvider,
		TripRecommendationsRepository,
		TripRecommendationsService,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class TripRecommendationsModule {}
