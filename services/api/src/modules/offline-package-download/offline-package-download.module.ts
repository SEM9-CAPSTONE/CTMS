import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OfflinePackagesModule } from "../offline-packages/offline-packages.module";
import { OfflineBasemapService } from "./offline-basemap.service";
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import { OfflinePackageDownloadController } from "./offline-package-download.controller";
import { OfflinePackageDownloadService } from "./offline-package-download.service";
import { PackageDepartureNotificationsController } from "./package-departure-notifications.controller";
import { PackageFreshnessController } from "./package-freshness.controller";
import { RouteRecoveryController } from "./route-recovery.controller";
import { RouteRecoveryRepository } from "./route-recovery.repository";
import { RouteRecoveryService } from "./route-recovery.service";

@Module({
	imports: [OfflinePackagesModule],
	controllers: [
		PackageDepartureNotificationsController,
		OfflinePackageDownloadController,
		RouteRecoveryController,
		PackageFreshnessController,
	],
	providers: [
		OfflinePackageAccessRepository,
		OfflinePackageDownloadService,
		OfflineBasemapService,
		RouteRecoveryRepository,
		RouteRecoveryService,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class OfflinePackageDownloadModule {}
