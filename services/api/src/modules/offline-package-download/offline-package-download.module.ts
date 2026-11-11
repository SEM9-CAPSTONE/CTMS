import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OfflinePackagesModule } from "../offline-packages/offline-packages.module";
import { OfflineBasemapService } from "./offline-basemap.service";
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import { OfflinePackageDownloadController } from "./offline-package-download.controller";
import { OfflinePackageDownloadService } from "./offline-package-download.service";
import { RouteRecoveryController } from "./route-recovery.controller";
import { RouteRecoveryRepository } from "./route-recovery.repository";
import { RouteRecoveryService } from "./route-recovery.service";

@Module({
	imports: [OfflinePackagesModule],
	controllers: [OfflinePackageDownloadController, RouteRecoveryController],
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
