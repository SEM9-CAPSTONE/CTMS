import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
	MAX_ITEMS,
	type PackageCheckpoint,
	type PackageCore,
	PackageFailure,
	PackageReason,
	type PackageWaypoint,
} from "./offline-packages.types";

@Injectable()
export class PackageCoreReader {
	async read(manager: EntityManager, tripId: string, lock = false): Promise<PackageCore> {
		// Existing core writers do not implement a revision-row protocol. These short final
		// SHARE locks fence inserts/deletes as well as updates, without changing those writers.
		if (lock)
			await manager.query(
				"LOCK TABLE trips,trekking_routes,checkpoints,trip_waypoints IN SHARE MODE"
			);
		const rows: PackageCore[] = await manager.query(
			`
		 SELECT t.id AS "tripId",t.status,t.trip_type AS "tripType",
		 t.starts_at AS "startsAt",t.ends_at AS "endsAt",t.route_id AS "routeId",
		 ST_AsGeoJSON(r.route_geom)::jsonb AS geometry
		 FROM trips t JOIN trekking_routes r ON r.id=t.route_id WHERE t.id=$1`,
			[tripId]
		);
		const core = rows[0];
		if (!core) throw new PackageFailure([PackageReason.CORE_INCOMPLETE]);
		const checkpoints: PackageCheckpoint[] = await manager.query(
			`
		 SELECT id,route_id AS "routeId",name,type,ST_AsGeoJSON(location)::jsonb AS location,
		 radius_m AS "radiusMeters",expected_arrival_offset AS "expectedArrivalOffset",instructions,
		 route_position AS "routePosition" FROM checkpoints WHERE route_id=$1 ORDER BY route_position,id LIMIT $2`,
			[core.routeId, MAX_ITEMS + 1]
		);
		const waypoints: PackageWaypoint[] = await manager.query(
			`
		 SELECT id,checkpoint_id AS "checkpointId",type,name,ST_AsGeoJSON(location)::jsonb AS location,
		 day_number AS "dayNumber",sequence_order AS "sequenceOrder",planned_at AS "plannedAt",
		 duration_minutes AS "durationMinutes" FROM trip_waypoints WHERE trip_id=$1
		 ORDER BY day_number,sequence_order,id LIMIT $2`,
			[tripId, MAX_ITEMS + 1]
		);
		return {
			...core,
			startsAt: new Date(core.startsAt).toISOString(),
			endsAt: new Date(core.endsAt).toISOString(),
			checkpoints,
			waypoints: waypoints.map((point) => ({
				...point,
				plannedAt: point.plannedAt ? new Date(point.plannedAt).toISOString() : null,
			})),
		};
	}
}
