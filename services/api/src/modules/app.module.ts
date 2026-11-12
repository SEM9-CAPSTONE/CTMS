import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database/database.module";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { CheckpointArrivalsModule } from "./checkpoint-arrivals/checkpoint-arrivals.module";
import { ContentReportsModule } from "./content-reports/content-reports.module";
import { DemandInsightsModule } from "./demand-insights/demand-insights.module";
import { DeviceSyncModule } from "./device-sync/device-sync.module";
import { EmergencyBroadcastsModule } from "./emergency-broadcasts/emergency-broadcasts.module";
import { EquipmentCatalogModule } from "./equipment-catalog/equipment-catalog.module";
import { GpsTrackingModule } from "./gps-tracking/gps-tracking.module";
import { HealthController } from "./health/health.controller";
import { HostOverviewModule } from "./host-overview/host-overview.module";
import { HostTripMapModule } from "./host-trip-map/host-trip-map.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { KnowledgeChunksModule } from "./knowledge-chunks/knowledge-chunks.module";
import { MemberLocationsModule } from "./member-locations/member-locations.module";
import { OfflinePackageDownloadModule } from "./offline-package-download/offline-package-download.module";
import { OfflinePackagesModule } from "./offline-packages/offline-packages.module";
import { OverbookingEvaluationModule } from "./overbooking-evaluation/overbooking-evaluation.module";
import { PerformanceReportsModule } from "./performance-reports/performance-reports.module";
import { PorterLevelsModule } from "./porter-levels/porter-levels.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { RealtimeEvaluationModule } from "./realtime-evaluation/realtime-evaluation.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ReviewAnalysisModule } from "./review-analysis/review-analysis.module";
import { RouteSafetyModule } from "./route-safety/route-safety.module";
import { SafetyEventsModule } from "./safety-events/safety-events.module";
import { ScheduleProgressModule } from "./schedule-progress/schedule-progress.module";
import { SosModule } from "./sos/sos.module";
import { SurvivalDocumentsModule } from "./survival-documents/survival-documents.module";
import { SyncEvaluationModule } from "./sync-evaluation/sync-evaluation.module";
import { TrekkingRoutesModule } from "./trekking-routes/trekking-routes.module";
import { TripReviewModerationModule } from "./trip-review-moderation/trip-review-moderation.module";
import { TripReviewsModule } from "./trip-reviews/trip-reviews.module";
import { TripsModule } from "./trips/trips.module";
import { UploadsModule } from "./uploads/uploads.module";
import { UsersModule } from "./users/users.module";
import { WeatherRiskEvaluationModule } from "./weather-risk-evaluation/weather-risk-evaluation.module";
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
		CheckpointArrivalsModule,
		ContentReportsModule,
		DeviceSyncModule,
		DemandInsightsModule,
		EmergencyBroadcastsModule,
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
		ScheduleProgressModule,
		MemberLocationsModule,
		SosModule,
		OverbookingEvaluationModule,
		WeatherRiskEvaluationModule,
		RealtimeEvaluationModule,
		PerformanceReportsModule,
		SyncEvaluationModule,
		UsersModule,
		TrekkingRoutesModule,
		TripsModule,
		TripReviewsModule,
		TripReviewModerationModule,
		ReviewAnalysisModule,
		UploadsModule,
		WeatherModule,
		SurvivalDocumentsModule,
		KnowledgeChunksModule,
		OfflinePackagesModule,
		OfflinePackageDownloadModule,
	],
	controllers: [HealthController],
})
export class AppModule {}
