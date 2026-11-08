import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OfflinePackagesModule } from "../offline-packages/offline-packages.module";
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import { OfflinePackageDownloadController } from "./offline-package-download.controller";
import { OfflinePackageDownloadService } from "./offline-package-download.service";

@Module({
	imports: [OfflinePackagesModule],
	controllers: [OfflinePackageDownloadController],
	providers: [
		OfflinePackageAccessRepository,
		OfflinePackageDownloadService,
		JwtAuthGuard,
		RolesGuard,
	],
})
export class OfflinePackageDownloadModule {}
