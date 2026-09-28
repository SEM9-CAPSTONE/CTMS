import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ContentReportsModule } from "./content-reports/content-reports.module";
import { EquipmentCatalogModule } from "./equipment-catalog/equipment-catalog.module";
import { HealthController } from "./health/health.controller";
import { ProfilesModule } from "./profiles/profiles.module";
import { EventsGateway } from "./realtime/events.gateway";
import { TrekkingRoutesModule } from "./trekking-routes/trekking-routes.module";
import { TripsModule } from "./trips/trips.module";
import { UsersModule } from "./users/users.module";
import { WeatherModule } from "./weather/weather.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ["../../.env", ".env"],
		}),
		DatabaseModule,
		AuthModule,
		BookingsModule,
		ContentReportsModule,
		EquipmentCatalogModule,
		ProfilesModule,
		UsersModule,
		TrekkingRoutesModule,
		TripsModule,
		WeatherModule,
	],
	controllers: [HealthController],
	providers: [EventsGateway],
})
export class AppModule {}
