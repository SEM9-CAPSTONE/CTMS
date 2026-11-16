import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Repository } from "typeorm";
import type { RouteDangerZoneResponseDto } from "../dto/route-danger-zone-response.dto";
import type {
	RouteDangerZone,
	RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
} from "../entities/route-danger-zone.entity";

export interface CreateRouteDangerZoneInput {
	routeId: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	description: string;
	severity: RouteDangerZoneSeverity;
}

interface RouteDangerZoneRow {
	id: string;
	routeId: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | string | null;
	description: string;
	severity: RouteDangerZoneSeverity;
	createdAt: Date;
	updatedAt: Date;
}

function toResponse(row: RouteDangerZoneRow): RouteDangerZoneResponseDto {
	return {
		...row,
		radiusMeters: row.radiusMeters == null ? null : Number(row.radiusMeters),
	};
}

const DANGER_ZONE_SELECT = `
	SELECT
		"id",
		"route_id" AS "routeId",
		ST_AsGeoJSON("geom"::geometry)::json AS "geometry",
		"radius_m" AS "radiusMeters",
		"description",
		"severity",
		"created_at" AS "createdAt",
		"updated_at" AS "updatedAt"
	FROM "route_danger_zones"
`;

@Injectable()
export class RouteDangerZonesRepository extends Repository<RouteDangerZone> {
	async findByRoute(routeId: string): Promise<RouteDangerZoneResponseDto[]> {
		const rows = (await this.query(
			`${DANGER_ZONE_SELECT}
			WHERE "route_id" = $1
			ORDER BY "created_at" ASC, "id" ASC`,
			[routeId]
		)) as RouteDangerZoneRow[];

		return rows.map(toResponse);
	}

	async findOneForUpdate(
		routeId: string,
		dangerZoneId: string
	): Promise<RouteDangerZoneResponseDto | null> {
		const rows = (await this.query(
			`${DANGER_ZONE_SELECT}
			WHERE "route_id" = $1 AND "id" = $2
			FOR UPDATE`,
			[routeId, dangerZoneId]
		)) as RouteDangerZoneRow[];
		return rows[0] ? toResponse(rows[0]) : null;
	}

	/** CTMS-118: replaces geometry, radius, description and severity of one hazard area. */
	async updateForRoute(
		dangerZoneId: string,
		input: CreateRouteDangerZoneInput
	): Promise<RouteDangerZoneResponseDto> {
		const rows = (await this.query(
			`
			WITH danger_zone_input AS (
				SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) AS geom
			), validated AS (
				SELECT geom
				FROM danger_zone_input
				WHERE GeometryType(geom) IN ('POINT', 'POLYGON')
					AND ST_SRID(geom) = 4326
					AND ST_IsValid(geom)
					AND NOT ST_IsEmpty(geom)
			), updated AS (
				UPDATE "route_danger_zones" zone
				SET "geom" = validated.geom::geography, "radius_m" = $4, "description" = $5,
					"severity" = $6, "updated_at" = now()
				FROM validated
				WHERE zone."route_id" = $1 AND zone."id" = $2
				RETURNING zone.*
			)
			SELECT
				"id",
				"route_id" AS "routeId",
				ST_AsGeoJSON("geom"::geometry)::json AS "geometry",
				"radius_m" AS "radiusMeters",
				"description",
				"severity",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM updated
			`,
			[
				input.routeId,
				dangerZoneId,
				JSON.stringify(input.geometry),
				input.radiusMeters,
				input.description,
				input.severity,
			]
		)) as RouteDangerZoneRow[];

		if (!rows[0]) throw invalidGeometry();
		return toResponse(rows[0]);
	}

	async createForRoute(input: CreateRouteDangerZoneInput): Promise<RouteDangerZoneResponseDto> {
		const rows = (await this.query(
			`
			WITH danger_zone_input AS (
				SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom
			), validated AS (
				SELECT geom
				FROM danger_zone_input
				WHERE GeometryType(geom) IN ('POINT', 'POLYGON')
					AND ST_SRID(geom) = 4326
					AND ST_IsValid(geom)
					AND NOT ST_IsEmpty(geom)
			), inserted AS (
				INSERT INTO "route_danger_zones" (
					"route_id", "geom", "radius_m", "description", "severity"
				)
				SELECT $1, geom::geography, $3, $4, $5
				FROM validated
				RETURNING *
			)
			SELECT
				"id",
				"route_id" AS "routeId",
				ST_AsGeoJSON("geom"::geometry)::json AS "geometry",
				"radius_m" AS "radiusMeters",
				"description",
				"severity",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM inserted
			`,
			[
				input.routeId,
				JSON.stringify(input.geometry),
				input.radiusMeters,
				input.description,
				input.severity,
			]
		)) as RouteDangerZoneRow[];

		const dangerZone = rows[0];
		if (!dangerZone) throw invalidGeometry();

		return toResponse(dangerZone);
	}
}

function invalidGeometry(): UnprocessableEntityException {
	return new UnprocessableEntityException({
		statusCode: 422,
		error: "Unprocessable Entity",
		message: [
			{
				field: "geometry",
				errors: ["geometry must be a valid, non-empty Point or Polygon"],
			},
		],
	});
}
