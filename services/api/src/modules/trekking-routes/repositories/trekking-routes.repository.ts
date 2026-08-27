import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Repository } from "typeorm";
import type { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
import type { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
import type { TrekkingRouteReviewResponseDto } from "../dto/trekking-route-review-response.dto";
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

interface LifecycleRouteRow extends CreatedRouteRow {
	hostId: string;
	integrityValid: boolean;
}

export interface LockedTrekkingRoute {
	route: TrekkingRouteResponseDto;
	hostId: string;
	integrityValid: boolean;
}

interface ReviewRouteRow extends CreatedRouteRow {
	campsiteName: string;
	checkpoints: CheckpointResponseDto[];
}

export interface ApprovalIntegrityResult {
	geometryValid: boolean;
	difficultyValid: boolean;
	checkpointsValid: boolean;
	checkpointCount: number;
}

function toResponse(row: CreatedRouteRow): TrekkingRouteResponseDto {
	return {
		...row,
		lengthMeters: Number(row.lengthMeters),
		expectedDurationMinutes: Number(row.expectedDurationMinutes),
	};
}

function toReviewResponse(row: ReviewRouteRow): TrekkingRouteReviewResponseDto {
	return {
		...toResponse(row),
		campsiteName: row.campsiteName,
		checkpoints: row.checkpoints.map((checkpoint) => ({
			...checkpoint,
			radiusMeters: Number(checkpoint.radiusMeters),
			expectedArrivalOffset: Number(checkpoint.expectedArrivalOffset),
			routePosition: Number(checkpoint.routePosition),
		})),
	};
}

const REVIEW_ROUTE_SELECT = `
	SELECT
		route."id",
		route."campsite_id" AS "campsiteId",
		route."name",
		route."description",
		ST_AsGeoJSON(route."route_geom"::geometry)::json AS "geometry",
		route."length_meters" AS "lengthMeters",
		route."difficulty",
		route."expected_duration_minutes" AS "expectedDurationMinutes",
		route."status",
		route."created_at" AS "createdAt",
		route."updated_at" AS "updatedAt",
		campsite."name" AS "campsiteName",
		COALESCE((
			SELECT jsonb_agg(
				jsonb_build_object(
					'id', checkpoint."id",
					'routeId', checkpoint."route_id",
					'name', checkpoint."name",
					'location', ST_AsGeoJSON(checkpoint."location"::geometry)::json,
					'radiusMeters', checkpoint."radius_m",
					'type', checkpoint."type",
					'expectedArrivalOffset', checkpoint."expected_arrival_offset",
					'instructions', checkpoint."instructions",
					'nearbyWaterOrShelter', checkpoint."nearby_water_or_shelter",
					'routePosition', checkpoint."route_position",
					'createdAt', checkpoint."created_at",
					'updatedAt', checkpoint."updated_at"
				)
				ORDER BY checkpoint."route_position", checkpoint."created_at", checkpoint."id"
			)
			FROM "checkpoints" checkpoint
			WHERE checkpoint."route_id" = route."id"
		), '[]'::jsonb) AS "checkpoints"
	FROM "trekking_routes" route
	INNER JOIN "campsites" campsite ON campsite."id" = route."campsite_id"
`;

@Injectable()
export class TrekkingRoutesRepository extends Repository<TrekkingRoute> {
	async findOneForLifecycleUpdate(routeId: string): Promise<LockedTrekkingRoute | null> {
		const rows = (await this.query(
			`
			SELECT
				route."id",
				route."campsite_id" AS "campsiteId",
				campsite."host_id" AS "hostId",
				route."name",
				route."description",
				ST_AsGeoJSON(route."route_geom"::geometry)::json AS "geometry",
				route."length_meters" AS "lengthMeters",
				route."difficulty",
				route."expected_duration_minutes" AS "expectedDurationMinutes",
				route."status",
				route."created_at" AS "createdAt",
				route."updated_at" AS "updatedAt",
				(
					BTRIM(route."name") <> ''
					AND GeometryType(route."route_geom"::geometry) = 'LINESTRING'
					AND ST_SRID(route."route_geom"::geometry) = 4326
					AND ST_NPoints(route."route_geom"::geometry) >= 2
					AND ST_IsValid(route."route_geom"::geometry)
					AND NOT ST_IsEmpty(route."route_geom"::geometry)
					AND ST_Length(route."route_geom") > 0
					AND route."length_meters" > 0
					AND route."expected_duration_minutes" > 0
					AND route."difficulty"::text IN ('easy', 'moderate', 'hard', 'expert')
					AND campsite."host_id" IS NOT NULL
				) AS "integrityValid"
			FROM "trekking_routes" route
			INNER JOIN "campsites" campsite ON campsite."id" = route."campsite_id"
			WHERE route."id" = $1
			FOR UPDATE OF route
			`,
			[routeId]
		)) as LifecycleRouteRow[];

		const row = rows[0];
		if (!row) return null;

		return {
			route: toResponse(row),
			hostId: row.hostId,
			integrityValid: row.integrityValid,
		};
	}

	async findPendingReview(): Promise<TrekkingRouteReviewResponseDto[]> {
		const rows = (await this.query(
			`${REVIEW_ROUTE_SELECT}
			WHERE route."status" = $1
			ORDER BY route."created_at" ASC, route."id" ASC`,
			[TrekkingRouteStatus.PENDING_APPROVAL]
		)) as ReviewRouteRow[];

		return rows.map(toReviewResponse);
	}

	async findReviewRouteByIdForUpdate(
		routeId: string
	): Promise<TrekkingRouteReviewResponseDto | null> {
		const rows = (await this.query(
			`${REVIEW_ROUTE_SELECT}
			WHERE route."id" = $1
			FOR UPDATE OF route`,
			[routeId]
		)) as ReviewRouteRow[];

		return rows[0] ? toReviewResponse(rows[0]) : null;
	}

	async validateApprovalIntegrity(routeId: string): Promise<ApprovalIntegrityResult> {
		const rows = (await this.query(
			`
			SELECT
				(
					NOT ST_IsEmpty(route."route_geom"::geometry)
					AND ST_IsValid(route."route_geom"::geometry)
					AND GeometryType(route."route_geom"::geometry) = 'LINESTRING'
					AND ST_SRID(route."route_geom"::geometry) = 4326
					AND ST_NPoints(route."route_geom"::geometry) >= 2
					AND ST_Length(route."route_geom") > 0
					AND route."length_meters" > 0
				) AS "geometryValid",
				(route."difficulty"::text IN ('easy', 'moderate', 'hard', 'expert')) AS "difficultyValid",
				NOT EXISTS (
					SELECT 1
					FROM "checkpoints" checkpoint
					WHERE checkpoint."route_id" = route."id"
						AND NOT (
							BTRIM(checkpoint."name") <> ''
							AND NOT ST_IsEmpty(checkpoint."location"::geometry)
							AND ST_IsValid(checkpoint."location"::geometry)
							AND GeometryType(checkpoint."location"::geometry) = 'POINT'
							AND ST_SRID(checkpoint."location"::geometry) = 4326
							AND checkpoint."radius_m" BETWEEN 10 AND 500
							AND checkpoint."type"::text IN (
								'start', 'rest', 'water', 'dangerous', 'emergency_shelter', 'finish'
							)
							AND checkpoint."expected_arrival_offset" BETWEEN 0
								AND route."expected_duration_minutes"
							AND BTRIM(checkpoint."instructions") <> ''
							AND checkpoint."route_position" BETWEEN 0 AND 1
							AND ST_DWithin(route."route_geom", checkpoint."location", 50)
						)
				) AS "checkpointsValid",
				(
					SELECT COUNT(*)::int FROM "checkpoints" checkpoint
					WHERE checkpoint."route_id" = route."id"
				) AS "checkpointCount"
			FROM "trekking_routes" route
			WHERE route."id" = $1
			`,
			[routeId]
		)) as ApprovalIntegrityResult[];

		const result = rows[0];
		return {
			geometryValid: Boolean(result?.geometryValid),
			difficultyValid: Boolean(result?.difficultyValid),
			checkpointsValid: Boolean(result?.checkpointsValid),
			checkpointCount: Number(result?.checkpointCount ?? 0),
		};
	}

	async updateStatus(
		routeId: string,
		status: TrekkingRouteStatus
	): Promise<TrekkingRouteResponseDto> {
		const rows = (await this.query(
			`
			WITH updated AS (
				UPDATE "trekking_routes"
				SET "status" = $2, "updated_at" = now()
				WHERE "id" = $1
				RETURNING *
			)
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
			FROM updated
			`,
			[routeId, status]
		)) as CreatedRouteRow[];

		return toResponse(rows[0]);
	}

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
