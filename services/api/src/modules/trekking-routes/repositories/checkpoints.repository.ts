import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Repository } from "typeorm";
import type { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
import type { CheckpointType, GeoPoint } from "../entities/checkpoint.entity";
import type { Checkpoint } from "../entities/checkpoint.entity";

const MAX_ROUTE_DISTANCE_METERS = 50;

export interface CreateCheckpointInput {
	routeId: string;
	name: string;
	location: GeoPoint;
	radiusMeters: number;
	type: CheckpointType;
	expectedArrivalOffset: number;
	instructions: string;
	nearbyWaterOrShelter: boolean;
}

interface CheckpointRow {
	id: string;
	routeId: string;
	name: string;
	location: GeoPoint;
	radiusMeters: number | string;
	type: CheckpointType;
	expectedArrivalOffset: number | string;
	instructions: string;
	nearbyWaterOrShelter: boolean;
	routePosition: number | string;
	createdAt: Date;
	updatedAt: Date;
}

function toResponse(row: CheckpointRow): CheckpointResponseDto {
	return {
		...row,
		radiusMeters: Number(row.radiusMeters),
		expectedArrivalOffset: Number(row.expectedArrivalOffset),
		routePosition: Number(row.routePosition),
	};
}

@Injectable()
export class CheckpointsRepository extends Repository<Checkpoint> {
	async findByRoute(routeId: string): Promise<CheckpointResponseDto[]> {
		const rows = (await this.query(
			`
			SELECT
				"id",
				"route_id" AS "routeId",
				"name",
				ST_AsGeoJSON("location"::geometry)::json AS "location",
				"radius_m" AS "radiusMeters",
				"type",
				"expected_arrival_offset" AS "expectedArrivalOffset",
				"instructions",
				"nearby_water_or_shelter" AS "nearbyWaterOrShelter",
				"route_position" AS "routePosition",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM "checkpoints"
			WHERE "route_id" = $1
			ORDER BY "route_position" ASC, "created_at" ASC, "id" ASC
			`,
			[routeId]
		)) as CheckpointRow[];

		return rows.map(toResponse);
	}

	async createForRoute(input: CreateCheckpointInput): Promise<CheckpointResponseDto> {
		const rows = (await this.query(
			`
			WITH checkpoint_input AS (
				SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography AS location
			), route_spatial AS (
				SELECT
					checkpoint_input.location,
					ST_LineLocatePoint(
						route."route_geom"::geometry,
						checkpoint_input.location::geometry
					) AS route_position
				FROM "trekking_routes" route
				CROSS JOIN checkpoint_input
				WHERE route."id" = $1
					AND ST_DWithin(
						route."route_geom",
						checkpoint_input.location,
						${MAX_ROUTE_DISTANCE_METERS}
					)
			), inserted AS (
				INSERT INTO "checkpoints" (
					"route_id", "name", "location", "radius_m", "type",
					"expected_arrival_offset", "instructions", "nearby_water_or_shelter", "route_position"
				)
				SELECT $1, $2, location, $4, $5, $6, $7, $8, route_position
				FROM route_spatial
				RETURNING *
			)
			SELECT
				"id",
				"route_id" AS "routeId",
				"name",
				ST_AsGeoJSON("location"::geometry)::json AS "location",
				"radius_m" AS "radiusMeters",
				"type",
				"expected_arrival_offset" AS "expectedArrivalOffset",
				"instructions",
				"nearby_water_or_shelter" AS "nearbyWaterOrShelter",
				"route_position" AS "routePosition",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM inserted
			`,
			[
				input.routeId,
				input.name,
				JSON.stringify(input.location),
				input.radiusMeters,
				input.type,
				input.expectedArrivalOffset,
				input.instructions,
				input.nearbyWaterOrShelter,
			]
		)) as CheckpointRow[];

		const checkpoint = rows[0];
		if (!checkpoint) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [
					{
						field: "location",
						errors: [`checkpoint must be within ${MAX_ROUTE_DISTANCE_METERS} meters of its route`],
					},
				],
			});
		}

		return toResponse(checkpoint);
	}
}
