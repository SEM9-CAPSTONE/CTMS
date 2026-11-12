import { Module } from "@nestjs/common";
import { OfflinePackagesRepository } from "./offline-packages.repository";
import { OfflinePackagesService } from "./offline-packages.service";
import { OfflineSafetySources } from "./offline-packages.types";
import { OfflinePackagesWorker } from "./offline-packages.worker";
import { UnavailableOfflineSafetySources } from "./offline-safety-sources";
import { PackageActivationService } from "./package-activation.service";
import { PackageArtifactBuilder } from "./package-artifact.builder";
import { LocalPackageArtifactStorage, PackageArtifactStorage } from "./package-artifact.storage";
import { PackageCoreReader } from "./package-core.reader";
import { PackageDepartureNotificationsService } from "./package-departure-notifications.service";
import {
	PackageFreshnessSource,
	UnavailablePackageFreshnessSource,
} from "./package-freshness.source";
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
} from "./package-policy";

@Module({
	providers: [
		PackageDepartureNotificationsService,
		PackageActivationService,
		{ provide: PackageFreshnessSource, useClass: UnavailablePackageFreshnessSource },
		OfflinePackagesRepository,
		OfflinePackagesService,
		OfflinePackagesWorker,
		PackageCoreReader,
		PackageArtifactBuilder,
		TripSafetyContextResolver,
		EligibleHazardResolver,
		ApprovedGuidanceSelector,
		PackageEligibilityValidator,
		{ provide: OfflineSafetySources, useClass: UnavailableOfflineSafetySources },
		{ provide: PackageArtifactStorage, useClass: LocalPackageArtifactStorage },
	],
	exports: [OfflinePackagesService, PackageActivationService, PackageDepartureNotificationsService],
})
export class OfflinePackagesModule {}
