import { Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackagesService } from "../offline-packages/offline-packages.service";
import { PackageFailure } from "../offline-packages/offline-packages.types";
import { canonical, digest } from "../offline-packages/package-policy";
import { TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import type { RouteRecoveryQueryDto } from "./route-recovery-query.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { RouteRecoveryRepository } from "./route-recovery.repository";
import { RecoveryReason, RecoveryStatus, type RouteRecoveryContext } from "./route-recovery.types";

@Injectable()
export class RouteRecoveryService {
	constructor(
		private readonly db: DataSource,
		private readonly access: OfflinePackageAccessRepository,
		private readonly repository: RouteRecoveryRepository,
		private readonly packages: OfflinePackagesService
	) {}

	async context(
		userId: string,
		tripId: string,
		query: RouteRecoveryQueryDto
	): Promise<RouteRecoveryContext> {
		const result = await this.db.transaction("REPEATABLE READ", async (manager) => {
			await manager.query("SET TRANSACTION READ ONLY");
			await manager.query("SET LOCAL statement_timeout='15s'");
			const tripStatus = await this.access.participantTripStatus(tripId, userId, manager);
			if (!tripStatus) throw this.notFound();
			const snapshot = await this.repository.route(manager, tripId);
			const response: RouteRecoveryContext = {
				status: RecoveryStatus.UNAVAILABLE,
				reason: null,
				tripId,
				tripStatus,
				observedAt: new Date(snapshot.observedAt).toISOString(),
				requested: { packageId: query.packageId, packageVersion: query.packageVersion },
				package: null,
				current: {
					routeId: snapshot.routeId,
					routeFingerprint: snapshot.geometry ? digest(canonical(snapshot.geometry)) : null,
					latestPackageVersion: snapshot.latestPackageVersion,
				},
				geometry: null,
				conventions: {
					coordinateSystem: "EPSG:4326",
					coordinateOrder: "longitude,latitude",
					distanceUnit: "metre",
					bearingUnit: "degree",
					bearingReference: "true-north-clockwise",
					bearingRange: "[0,360)",
				},
			};
			if (tripStatus !== TripStatus.PUBLISHED && tripStatus !== TripStatus.ONGOING) {
				response.reason = RecoveryReason.TRIP_NOT_NAVIGABLE;
				return response;
			}
			const metadata = await this.repository.package(manager, tripId, query.packageVersion);
			if (!metadata) {
				response.reason = RecoveryReason.PACKAGE_NOT_FOUND;
				return response;
			}
			if (metadata.id !== query.packageId) {
				response.status = RecoveryStatus.MISMATCH;
				response.reason = RecoveryReason.PACKAGE_ID_VERSION_MISMATCH;
				return response;
			}
			try {
				response.geometry = await this.packages.readSnapshotRoute(metadata);
				response.package = {
					id: metadata.id,
					version: metadata.package_version,
					sha256: metadata.sha256,
					generatedAt: new Date(metadata.generated_at).toISOString(),
					routeId: metadata.manifest.route.routeId,
					routeFingerprint: metadata.manifest.route.fingerprint,
				};
			} catch (error) {
				if (!(error instanceof PackageFailure)) throw error;
				response.reason = RecoveryReason.ARTIFACT_UNAVAILABLE;
				return response;
			}
			if (!snapshot.geometry || !snapshot.routeId) {
				response.geometry = null;
				response.reason = RecoveryReason.ROUTE_UNAVAILABLE;
			} else if (response.package.routeId !== snapshot.routeId) {
				response.status = RecoveryStatus.MISMATCH;
				response.reason = RecoveryReason.ROUTE_ID_MISMATCH;
				response.geometry = null;
			} else if (response.package.routeFingerprint !== response.current.routeFingerprint) {
				response.status = RecoveryStatus.STALE;
				response.reason = RecoveryReason.ROUTE_VERSION_CHANGED;
			} else if ((snapshot.latestPackageVersion ?? 0) > metadata.package_version) {
				response.status = RecoveryStatus.STALE;
				response.reason = RecoveryReason.NEWER_PACKAGE_AVAILABLE;
			} else {
				response.status = RecoveryStatus.AVAILABLE;
			}
			return response;
		});
		// A new authorization check catches a participant revoked during file verification.
		if (!(await this.access.participantTripStatus(tripId, userId))) throw this.notFound();
		return result;
	}
	private notFound(): NotFoundException {
		return new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE", message: "Trip not found" });
	}
}
