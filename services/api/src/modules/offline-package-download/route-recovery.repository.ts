import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { PackageMetadata } from "../offline-packages/offline-packages.types";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";

export interface RecoveryRouteSnapshot {
	routeId: string | null;
	geometry: GeoLineString | null;
	latestPackageVersion: number | null;
	observedAt: Date;
}

@Injectable()
export class RouteRecoveryRepository {
	async route(manager: EntityManager, tripId: string): Promise<RecoveryRouteSnapshot> {
		const rows: RecoveryRouteSnapshot[] = await manager.query(
			`SELECT t.route_id AS "routeId", ST_AsGeoJSON(r.route_geom::geometry)::json AS geometry,
			 (SELECT max(package_version) FROM offline_packages WHERE trip_id=t.id) AS "latestPackageVersion",
			 transaction_timestamp() AS "observedAt"
			 FROM trips t LEFT JOIN trekking_routes r ON r.id=t.route_id WHERE t.id=$1`,
			[tripId]
		);
		return rows[0];
	}
	async package(
		manager: EntityManager,
		tripId: string,
		version: number
	): Promise<PackageMetadata | null> {
		const rows: PackageMetadata[] = await manager.query(
			"SELECT * FROM offline_packages WHERE trip_id=$1 AND package_version=$2",
			[tripId, version]
		);
		return rows[0] ?? null;
	}
}
