import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ContentReportsModule } from "./content-reports/content-reports.module";
import { DemandInsightsModule } from "./demand-insights/demand-insights.module";
import { DeviceSyncModule } from "./device-sync/device-sync.module";
import { EquipmentCatalogModule } from "./equipment-catalog/equipment-catalog.module";
import { GpsTrackingModule } from "./gps-tracking/gps-tracking.module";
import { HealthController } from "./health/health.controller";
import { HostOverviewModule } from "./host-overview/host-overview.module";
import { HostTripMapModule } from "./host-trip-map/host-trip-map.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { KnowledgeChunksModule } from "./knowledge-chunks/knowledge-chunks.module";
import { OverbookingEvaluationModule } from "./overbooking-evaluation/overbooking-evaluation.module";
import { PorterLevelsModule } from "./porter-levels/porter-levels.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ReviewAnalysisModule } from "./review-analysis/review-analysis.module";
import { RouteSafetyModule } from "./route-safety/route-safety.module";
import { SafetyEventsModule } from "./safety-events/safety-events.module";
import { SosModule } from "./sos/sos.module";
import { SurvivalDocumentsModule } from "./survival-documents/survival-documents.module";
import { SyncEvaluationModule } from "./sync-evaluation/sync-evaluation.module";
import { TrekkingRoutesModule } from "./trekking-routes/trekking-routes.module";
import { TripReviewsModule } from "./trip-reviews/trip-reviews.module";
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
		DemandInsightsModule,
		EquipmentCatalogModule,
		GpsTrackingModule,
		HostOverviewModule,
		HostTripMapModule,
		IncidentsModule,
		ProfilesModule,
		PorterLevelsModule,
		RealtimeModule,
		RouteSafetyModule,
		SafetyEventsModule,
		SosModule,
		OverbookingEvaluationModule,
		SyncEvaluationModule,
		UsersModule,
		TrekkingRoutesModule,
		TripsModule,
		TripReviewsModule,
		ReviewAnalysisModule,
		UploadsModule,
		WeatherModule,
		SurvivalDocumentsModule,
		KnowledgeChunksModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
