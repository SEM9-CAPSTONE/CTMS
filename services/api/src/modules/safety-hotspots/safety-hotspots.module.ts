import { Module } from "@nestjs/common";
import { SafetyHotspotsController } from "./safety-hotspots.controller";
import { SafetyHotspotsRepository } from "./safety-hotspots.repository";
import { SafetyHotspotsService } from "./safety-hotspots.service";
import { SafetyHotspotsWorker } from "./safety-hotspots.worker";

/** CTMS-116: PotentialSafetyHotspot detection from historical RouteDeviationEvents. */
@Module({
	controllers: [SafetyHotspotsController],
	providers: [SafetyHotspotsService, SafetyHotspotsRepository, SafetyHotspotsWorker],
	exports: [SafetyHotspotsService, SafetyHotspotsRepository],
})
export class SafetyHotspotsModule {}
