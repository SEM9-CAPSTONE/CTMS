import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Repository } from "typeorm";
import type { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
import type { GeoLineString, TrekkingRouteDifficulty } from "../entities/trekking-route.entity";
import { type TrekkingRoute, TrekkingRouteStatus } from "../entities/trekking-route.entity";

export interface CreateDraftTrekkingRouteInput {
	campsiteId: string;
	name: string;
	description: string | null;
	geometry: GeoLineString;
	difficulty: TrekkingRouteDifficulty;
	expectedDurationMinutes: number;
}

interface CreatedRouteRow {
	id: string;
	campsiteId: string;
	name: string;
	description: string | null;
	geometry: GeoLineString;
	lengthMeters: number;
	difficulty: TrekkingRouteDifficulty;
	expectedDurationMinutes: number;
	status: TrekkingRouteStatus;
	createdAt: Date;
	updatedAt: Date;
}

function toResponse(row: CreatedRouteRow): TrekkingRouteResponseDto {
	return {
		...row,
		lengthMeters: Number(row.lengthMeters),
		expectedDurationMinutes: Number(row.expectedDurationMinutes),
	};
}

@Injectable()
export class TrekkingRoutesRepository extends Repository<TrekkingRoute> {
	async findByCampsite(campsiteId: string): Promise<TrekkingRouteResponseDto[]> {
		const rows = (await this.query(
			`
			SELECT
				"id",
				"campsite_id" AS "campsiteId",
				"name",
				"description",
				ST_AsGeoJSON("route_geom"::geometry)::json AS "geometry",
				"length_meters" AS "lengthMeters",
				"difficulty",
				"expected_duration_minutes" AS "expectedDurationMinutes",
				"status",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM "trekking_routes"
			WHERE "campsite_id" = $1
			ORDER BY "created_at" DESC, "id" ASC
			`,
			[campsiteId]
		)) as CreatedRouteRow[];

		return rows.map(toResponse);
	}

	async createDraft(input: CreateDraftTrekkingRouteInput): Promise<TrekkingRouteResponseDto> {
		const rows = (await this.query(
			`
			WITH route_input AS (
				SELECT ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography AS route_geom
			), measured_route AS (
				SELECT route_geom, ST_Length(route_geom) AS length_meters
				FROM route_input
			)
			INSERT INTO "trekking_routes" (
				"campsite_id",
				"name",
				"description",
				"route_geom",
				"length_meters",
				"difficulty",
				"expected_duration_minutes",
				"status"
			)
			SELECT $1, $2, $3, route_geom, length_meters, $5, $6, $7
			FROM measured_route
			WHERE length_meters > 0
			RETURNING
				"id",
				"campsite_id" AS "campsiteId",
				"name",
				"description",
				ST_AsGeoJSON("route_geom"::geometry)::json AS "geometry",
				"length_meters" AS "lengthMeters",
				"difficulty",
				"expected_duration_minutes" AS "expectedDurationMinutes",
				"status",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			`,
			[
				input.campsiteId,
				input.name,
				input.description,
				JSON.stringify(input.geometry),
				input.difficulty,
				input.expectedDurationMinutes,
				TrekkingRouteStatus.DRAFT,
			]
		)) as CreatedRouteRow[];

		const route = rows[0];
		if (!route) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [{ field: "geometry", errors: ["route length must be greater than zero"] }],
			});
		}

		return toResponse(route);
	}
}
