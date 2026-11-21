import { Module } from "@nestjs/common";
import { OfflinePackagesModule } from "../offline-packages/offline-packages.module";
import { TrekkingRoutesModule } from "../trekking-routes/trekking-routes.module";
import { HotspotCorrectiveActionsRepository } from "./hotspot-corrective-actions.repository";
import { HotspotCorrectiveActionsService } from "./hotspot-corrective-actions.service";
import { HotspotDetailsService } from "./hotspot-details.service";
import { HotspotPackageImpactDispatcher } from "./hotspot-package-impact.dispatcher";
import { HotspotPackageImpactWorker } from "./hotspot-package-impact.worker";
import { HotspotReviewService } from "./hotspot-review.service";
import { SafetyHotspotsController } from "./safety-hotspots.controller";
import { SafetyHotspotsRepository } from "./safety-hotspots.repository";
import { SafetyHotspotsService } from "./safety-hotspots.service";
import { SafetyHotspotsWorker } from "./safety-hotspots.worker";

/**
 * CTMS-116: PotentialSafetyHotspot detection from historical RouteDeviationEvents.
 * CTMS-118: history of earlier corrective actions; Admins now edit or delete hotspots directly.
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
		HotspotReviewService,
		HotspotDetailsService,
	],
	exports: [SafetyHotspotsService, SafetyHotspotsRepository],
})
export class SafetyHotspotsModule {}
