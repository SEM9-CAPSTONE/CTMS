import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import { SAFETY_FEATURE_LIMIT } from "./route-safety.policy";
import type { SafetyCandidate } from "./route-safety.types";

@Injectable()
export class RouteSafetyRepository {
	constructor(private readonly db: DataSource) {}

	async findOwner(routeId: string): Promise<string | null> {
		const rows: Array<{ hostId: string }> = await this.db.query(
			`SELECT host_id AS "hostId" FROM trekking_routes WHERE id = $1`,
			[routeId]
		);
		return rows[0]?.hostId ?? null;
	}

	async candidates(
		hostId: string,
		routeId: string | undefined,
		geometry: GeoLineString,
		proximity: number,
		live: SafetyCandidate[] = [],
		excludeStoredCurrent = false
	): Promise<SafetyCandidate[]> {
		// Field incidents are scoped through the authoritative Trip host, never shared nationally.
		// Geographies and the matching GiST indexes keep distance thresholds in meters.
		return this.db.query(
			`
		WITH route AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326)::geography AS geom),
		live_records AS (
		 SELECT v, ST_SetSRID(ST_GeomFromGeoJSON((v->'geometry')::text),4326)::geography AS geom
		 FROM jsonb_array_elements($6::jsonb) AS v
		),
		candidates AS (
		 SELECT 'external:' || s.id AS id, s.source_type AS "sourceType", s.source,
		 s.source_reference AS "sourceReference", s.hazard_type AS "hazardType", s.severity,
		 s.geom, s.geometry_role AS "geometryRole", s.description,
		 s.observed_at AS "observedAt", s.issued_at AS "issuedAt", s.fetched_at AS "fetchedAt",
		 s.valid_from AS "validFrom", s.valid_until AS "validUntil", s.updated_at AS "updatedAt",
		 s.lifecycle_status AS "lifecycleStatus", s.verification_status AS "verificationStatus",
		 s.accuracy_meters AS "accuracyMeters", NULL::float8 AS "radiusMeters"
		 FROM external_safety_features s CROSS JOIN route r
		 WHERE (NOT $7::boolean OR s.source_type <> 'OFFICIAL_CURRENT') AND
		 ((GeometryType(s.geom::geometry) = 'POINT' AND ST_DWithin(s.geom,r.geom,$4))
		 OR (GeometryType(s.geom::geometry) <> 'POINT' AND ST_Intersects(s.geom,r.geom)))
		 UNION ALL
		 SELECT s.v->>'id', s.v->>'sourceType', s.v->>'source', s.v->>'sourceReference',
		 s.v->>'hazardType', s.v->>'severity', s.geom, s.v->>'geometryRole', s.v->>'description',
		 (s.v->>'observedAt')::timestamptz, (s.v->>'issuedAt')::timestamptz,
		 (s.v->>'fetchedAt')::timestamptz, (s.v->>'validFrom')::timestamptz,
		 (s.v->>'validUntil')::timestamptz, (s.v->>'updatedAt')::timestamptz,
		 s.v->>'lifecycleStatus', s.v->>'verificationStatus', NULL::float8, NULL::float8
		 FROM live_records s CROSS JOIN route r
		 WHERE ST_DWithin(s.geom,r.geom,$4)
		 UNION ALL
		 SELECT 'host:' || z.id, 'HOST_DEFINED', 'CTMS', z.id::text, 'host_defined',
		 upper(z.severity::text), z.geom, 'host_defined_area', z.description,
		 z.created_at, NULL, NULL, NULL, NULL, z.updated_at,
		 'ACTIVE', 'UNVERIFIED', NULL::float8, z.radius_m
		 FROM route_danger_zones z JOIN trekking_routes t ON t.id=z.route_id CROSS JOIN route r
		 WHERE t.host_id=$2 AND t.id=$3 AND
		 ((GeometryType(z.geom::geometry)='POINT' AND ST_DWithin(z.geom,r.geom,GREATEST($4,z.radius_m)))
		 OR (GeometryType(z.geom::geometry)<>'POINT' AND ST_Intersects(z.geom,r.geom)))
		 UNION ALL
		 SELECT 'incident:' || i.id, 'FIELD_OBSERVATION', 'CTMS', i.id::text, i.category::text,
		 CASE WHEN i.severity::text='critical' THEN 'VERY_HIGH' ELSE upper(i.severity::text) END,
		 i.location, 'field_observation', i.description, i.occurred_at, NULL, i.received_at,
		 NULL, NULL, i.received_at,
		 CASE WHEN i.status::text IN ('resolved','closed') THEN 'RESOLVED' ELSE 'ACTIVE' END,
		 'UNVERIFIED', i.location_accuracy_meters, NULL::float8
		 FROM trip_incidents i JOIN trips t ON t.id=i.trip_id CROSS JOIN route r
		 WHERE t.host_id=$2 AND ($3::uuid IS NULL OR t.route_id=$3)
		 AND i.location IS NOT NULL AND ST_DWithin(i.location,r.geom,$4)
		)
		SELECT c.id,c."sourceType",c.source,c."sourceReference",c."hazardType",c.severity,
		 ST_AsGeoJSON(c.geom::geometry)::json AS geometry,c."geometryRole",c.description,
		 c."observedAt",c."issuedAt",c."fetchedAt",c."validFrom",c."validUntil",c."updatedAt",
		 c."lifecycleStatus",c."verificationStatus",c."accuracyMeters",c."radiusMeters",
		 ST_Distance(c.geom,r.geom) AS "distanceMeters",ST_Intersects(c.geom,r.geom) AS intersects
		FROM candidates c CROSS JOIN route r
		WHERE c."sourceType" <> 'RESOURCE' OR (
		 GeometryType(c.geom::geometry) IN ('POINT', 'LINESTRING')
		 AND c."hazardType" NOT IN ('water_water', 'water_surface', 'water_lake', 'water_reservoir')
		)
		ORDER BY ST_Distance(c.geom,r.geom), c.id LIMIT $5
		`,
			[
				JSON.stringify(geometry),
				hostId,
				routeId ?? null,
				proximity,
				SAFETY_FEATURE_LIMIT + 1,
				JSON.stringify(live),
				excludeStoredCurrent,
			]
		);
	}
}
