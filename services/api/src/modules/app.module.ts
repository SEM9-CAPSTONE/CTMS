import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ContentReportsModule } from "./content-reports/content-reports.module";
import { DeviceSyncModule } from "./device-sync/device-sync.module";
import { EquipmentCatalogModule } from "./equipment-catalog/equipment-catalog.module";
import { GpsTrackingModule } from "./gps-tracking/gps-tracking.module";
import { HealthController } from "./health/health.controller";
import { HostOverviewModule } from "./host-overview/host-overview.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { PorterLevelsModule } from "./porter-levels/porter-levels.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SafetyEventsModule } from "./safety-events/safety-events.module";
import { SosModule } from "./sos/sos.module";
import { SyncEvaluationModule } from "./sync-evaluation/sync-evaluation.module";
import { TrekkingRoutesModule } from "./trekking-routes/trekking-routes.module";
import { TripsModule } from "./trips/trips.module";
import { UploadsModule } from "./uploads/uploads.module";
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
		DeviceSyncModule,
		EquipmentCatalogModule,
		GpsTrackingModule,
		HostOverviewModule,
		IncidentsModule,
		ProfilesModule,
		PorterLevelsModule,
		RealtimeModule,
		SafetyEventsModule,
		SosModule,
		SyncEvaluationModule,
		UsersModule,
		TrekkingRoutesModule,
		TripsModule,
		UploadsModule,
		WeatherModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
