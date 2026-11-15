import { Module } from "@nestjs/common";
import { OfflinePackagesModule } from "../offline-packages/offline-packages.module";
import { TrekkingRoutesModule } from "../trekking-routes/trekking-routes.module";
import { HotspotCorrectiveActionsRepository } from "./hotspot-corrective-actions.repository";
import { HotspotCorrectiveActionsService } from "./hotspot-corrective-actions.service";
import { HotspotPackageImpactDispatcher } from "./hotspot-package-impact.dispatcher";
import { HotspotPackageImpactWorker } from "./hotspot-package-impact.worker";
import { SafetyHotspotsController } from "./safety-hotspots.controller";
import { SafetyHotspotsRepository } from "./safety-hotspots.repository";
import { SafetyHotspotsService } from "./safety-hotspots.service";
import { SafetyHotspotsWorker } from "./safety-hotspots.worker";

/**
 * CTMS-116: PotentialSafetyHotspot detection from historical RouteDeviationEvents.
 * CTMS-118: Admin corrective actions on CONFIRMED hotspots, applied through the Route module.
 */
@Module({
	imports: [TrekkingRoutesModule, OfflinePackagesModule],
	controllers: [SafetyHotspotsController],
	providers: [
		SafetyHotspotsService,
		SafetyHotspotsRepository,
		SafetyHotspotsWorker,
		HotspotCorrectiveActionsRepository,
		HotspotCorrectiveActionsService,
		HotspotPackageImpactDispatcher,
		HotspotPackageImpactWorker,
	],
	exports: [SafetyHotspotsService, SafetyHotspotsRepository],
})
export class SafetyHotspotsModule {}
