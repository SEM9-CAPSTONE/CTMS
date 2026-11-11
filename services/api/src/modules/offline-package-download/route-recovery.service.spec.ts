import { NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import type { OfflinePackagesService } from "../offline-packages/offline-packages.service";
import {
	PackageFailure,
	type PackageMetadata,
	PackageReason,
} from "../offline-packages/offline-packages.types";
import { canonical, digest } from "../offline-packages/package-policy";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import type { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import type { RecoveryRouteSnapshot, RouteRecoveryRepository } from "./route-recovery.repository";
import { RouteRecoveryService } from "./route-recovery.service";
import { RecoveryReason, RecoveryStatus } from "./route-recovery.types";

describe("CTMS-315 recovery context policy", () => {
	const geometry: GeoLineString = {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.01, 16.01],
		],
	};
	const query = { packageId: "package-1", packageVersion: 1 };
	const manager = { query: jest.fn() };
	const access = { participantTripStatus: jest.fn() };
	const repository = { route: jest.fn(), package: jest.fn() };
	const packages = { readSnapshotRoute: jest.fn() };
	const transaction = jest.fn(
		async (_isolation: string, run: (manager: EntityManager) => Promise<unknown>) =>
			run(manager as unknown as EntityManager)
	);
	const service = new RouteRecoveryService(
		{ transaction } as unknown as DataSource,
		access as unknown as OfflinePackageAccessRepository,
		repository as unknown as RouteRecoveryRepository,
		packages as unknown as OfflinePackagesService
	);
	let snapshot: RecoveryRouteSnapshot;
	beforeEach(() => {
		jest.clearAllMocks();
		access.participantTripStatus.mockResolvedValue(TripStatus.ONGOING);
		snapshot = {
			routeId: "route",
			geometry,
			latestPackageVersion: 1,
			observedAt: new Date("2026-11-11T00:00:00Z"),
		};
		repository.route.mockResolvedValue(snapshot);
		repository.package.mockResolvedValue({
			id: query.packageId,
			trip_id: "trip",
			package_version: 1,
			sha256: "a".repeat(64),
			generated_at: snapshot.observedAt,
			manifest: { route: { routeId: "route", fingerprint: digest(canonical(geometry)) } },
		} as PackageMetadata);
		packages.readSnapshotRoute.mockResolvedValue(geometry);
	});
	it("returns exact verified context under a read-only repeatable snapshot", async () => {
		const response = await service.context("user", "trip", query);
		expect(response).toMatchObject({
			status: RecoveryStatus.AVAILABLE,
			reason: null,
			geometry,
			requested: query,
			package: { id: query.packageId, version: 1 },
			conventions: { coordinateOrder: "longitude,latitude", bearingRange: "[0,360)" },
		});
		expect(transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function));
		expect(manager.query).toHaveBeenCalledWith("SET TRANSACTION READ ONLY");
		expect(access.participantTripStatus).toHaveBeenCalledWith("trip", "user", manager);
	});
	it.each([TripStatus.PUBLISHED, TripStatus.ONGOING])(
		"supports %s without declaring server activation",
		async (status) => {
			access.participantTripStatus.mockResolvedValue(status);
			const response = await service.context("user", "trip", query);
			expect(response.status).toBe(RecoveryStatus.AVAILABLE);
			expect(response).not.toHaveProperty("active");
		}
	);
	it.each([TripStatus.COMPLETED, TripStatus.CANCELLED, TripStatus.DRAFT])(
		"does not navigate %s trips",
		async (status) => {
			access.participantTripStatus.mockResolvedValue(status);
			expect(await service.context("user", "trip", query)).toMatchObject({
				status: RecoveryStatus.UNAVAILABLE,
				reason: RecoveryReason.TRIP_NOT_NAVIGABLE,
				geometry: null,
			});
			expect(packages.readSnapshotRoute).not.toHaveBeenCalled();
		}
	);
	it("does not reveal packages to absent/unrelated participants", async () => {
		access.participantTripStatus.mockResolvedValue(null);
		await expect(service.context("user", "trip", query)).rejects.toBeInstanceOf(NotFoundException);
		expect(repository.package).not.toHaveBeenCalled();
	});
	it("rechecks authorization after verification", async () => {
		access.participantTripStatus
			.mockResolvedValueOnce(TripStatus.ONGOING)
			.mockResolvedValueOnce(null);
		await expect(service.context("user", "trip", query)).rejects.toBeInstanceOf(NotFoundException);
	});
	it("never substitutes a different package UUID", async () => {
		expect(
			await service.context("user", "trip", { ...query, packageId: "different" })
		).toMatchObject({
			status: RecoveryStatus.MISMATCH,
			reason: RecoveryReason.PACKAGE_ID_VERSION_MISMATCH,
			geometry: null,
			package: null,
		});
		expect(packages.readSnapshotRoute).not.toHaveBeenCalled();
	});
	it("reports missing exact version without using latest", async () => {
		repository.package.mockResolvedValue(null);
		expect(await service.context("user", "trip", query)).toMatchObject({
			reason: RecoveryReason.PACKAGE_NOT_FOUND,
			geometry: null,
		});
	});
	it("maps artifact verification errors to unavailable", async () => {
		packages.readSnapshotRoute.mockRejectedValue(
			new PackageFailure([PackageReason.ARTIFACT_INVALID])
		);
		expect(await service.context("user", "trip", query)).toMatchObject({
			status: RecoveryStatus.UNAVAILABLE,
			reason: RecoveryReason.ARTIFACT_UNAVAILABLE,
			geometry: null,
			package: null,
		});
	});
	it("keeps old geometry when route fingerprint changes", async () => {
		snapshot.geometry = {
			type: "LineString",
			coordinates: [
				[109, 17],
				[109.01, 17.01],
			],
		};
		const response = await service.context("user", "trip", query);
		expect(response).toMatchObject({
			status: RecoveryStatus.STALE,
			reason: RecoveryReason.ROUTE_VERSION_CHANGED,
			geometry,
		});
		expect(response.package?.routeFingerprint).not.toBe(response.current.routeFingerprint);
	});
	it("keeps exact requested geometry when a newer package exists", async () => {
		snapshot.latestPackageVersion = 2;
		expect(await service.context("user", "trip", query)).toMatchObject({
			status: RecoveryStatus.STALE,
			reason: RecoveryReason.NEWER_PACKAGE_AVAILABLE,
			geometry,
			current: { latestPackageVersion: 2 },
		});
	});
	it("withholds geometry for another route identity", async () => {
		snapshot.routeId = "another-route";
		expect(await service.context("user", "trip", query)).toMatchObject({
			status: RecoveryStatus.MISMATCH,
			reason: RecoveryReason.ROUTE_ID_MISMATCH,
			geometry: null,
		});
	});
	it("withholds geometry when current route is missing", async () => {
		snapshot.geometry = null;
		expect(await service.context("user", "trip", query)).toMatchObject({
			reason: RecoveryReason.ROUTE_UNAVAILABLE,
			geometry: null,
		});
	});
	it("does not disguise unexpected infrastructure failures as a missing artifact", async () => {
		packages.readSnapshotRoute.mockRejectedValue(new Error("Unexpected infrastructure failure"));
		await expect(service.context("user", "trip", query)).rejects.toThrow(
			"Unexpected infrastructure"
		);
	});
});
