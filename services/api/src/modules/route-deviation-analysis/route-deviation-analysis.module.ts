import { Module } from "@nestjs/common";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { RouteDeviationAnalysisController } from "./route-deviation-analysis.controller";
import { RouteDeviationAnalysisRepository } from "./route-deviation-analysis.repository";
import { RouteDeviationAnalysisService } from "./route-deviation-analysis.service";
import { RouteDeviationAnalysisWorker } from "./route-deviation-analysis.worker";

/** CTMS-115: historical Route Deviation Events from completed Trips' GPS logs. */
@Module({
	imports: [GpsTrackingModule],
	controllers: [RouteDeviationAnalysisController],
	providers: [
		RouteDeviationAnalysisService,
		RouteDeviationAnalysisRepository,
		RouteDeviationAnalysisWorker,
	],
	exports: [RouteDeviationAnalysisService, RouteDeviationAnalysisRepository],
})
export class RouteDeviationAnalysisModule {}
