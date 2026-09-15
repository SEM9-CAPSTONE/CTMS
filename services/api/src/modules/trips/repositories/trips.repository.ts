import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { TripResponseDto, TripWaypointResponseDto } from "../dto/trip-response.dto";
import type { WaypointType } from "../entities/trip-waypoint.entity";
import type { GeoPoint, Trip, TripType } from "../entities/trip.entity";
import { TripStatus } from "../entities/trip.entity";

export interface CreateTripWaypointInput {
	checkpointId: string | null;
	type: WaypointType;
	name: string;
	location: GeoPoint;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: Date | null;
	durationMinutes: number | null;
	metadata: Record<string, unknown> | null;
}

export interface CreateTripInput {
	hostId: string;
	routeId: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	tripType: TripType;
	durationNights: number;
	startsAt: Date;
	endsAt: Date;
	meetingPoint: GeoPoint;
	meetingAt: Date | null;
	bookingDeadline: Date;
	capacityMin: number;
	capacityMax: number;
	isFree: boolean;
	pricePerPerson: number;
	provinceCode: string;
	cityCode: string;
	cancellationPolicy: Record<string, unknown> | null;
	waypoints: CreateTripWaypointInput[];
}

export interface TripRouteDependency {
	id: string;
	hostId: string;
	status: string;
}

interface TripRow {
	id: string;
	hostId: string;
	routeId: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	tripType: TripType;
	durationNights: number | string;
	startsAt: Date;
	endsAt: Date;
	meetingPoint: GeoPoint;
	meetingAt: Date | null;
	bookingDeadline: Date;
	capacityMin: number | string;
	capacityMax: number | string;
	seatsTaken: number | string;
	isFree: boolean;
	pricePerPerson: number | string;
	provinceCode: string;
	cityCode: string;
	cancellationPolicy: Record<string, unknown> | null;
	status: TripStatus;
	createdAt: Date;
	updatedAt: Date;
	waypoints: TripWaypointRow[];
}

interface TripWaypointRow {
	id: string;
	tripId: string;
	checkpointId: string | null;
	type: WaypointType;
	name: string;
	location: GeoPoint;
	dayNumber: number | string;
	sequenceOrder: number | string;
	plannedAt: Date | null;
	durationMinutes: number | string | null;
	metadata: Record<string, unknown> | null;
}

function toWaypointResponse(row: TripWaypointRow): TripWaypointResponseDto {
	return {
		...row,
		dayNumber: Number(row.dayNumber),
		sequenceOrder: Number(row.sequenceOrder),
		durationMinutes: row.durationMinutes == null ? null : Number(row.durationMinutes),
	};
}

function toTripResponse(row: TripRow): TripResponseDto {
	return {
		...row,
		durationNights: Number(row.durationNights),
		capacityMin: Number(row.capacityMin),
		capacityMax: Number(row.capacityMax),
		seatsTaken: Number(row.seatsTaken),
		pricePerPerson: Number(row.pricePerPerson),
		waypoints: row.waypoints.map(toWaypointResponse),
	};
}

const TRIP_SELECT = `
	SELECT
		trip."id",
		trip."host_id" AS "hostId",
		trip."route_id" AS "routeId",
		trip."title",
		trip."description",
		trip."cover_image_url" AS "coverImageUrl",
		trip."itinerary",
		trip."includes",
		trip."excludes",
		trip."trip_type" AS "tripType",
		trip."duration_nights" AS "durationNights",
		trip."starts_at" AS "startsAt",
		trip."ends_at" AS "endsAt",
		ST_AsGeoJSON(trip."meeting_point"::geometry)::json AS "meetingPoint",
		trip."meeting_at" AS "meetingAt",
		trip."booking_deadline" AS "bookingDeadline",
		trip."capacity_min" AS "capacityMin",
		trip."capacity_max" AS "capacityMax",
		trip."seats_taken" AS "seatsTaken",
		trip."is_free" AS "isFree",
		trip."price_per_person" AS "pricePerPerson",
		trip."province_code" AS "provinceCode",
		trip."city_code" AS "cityCode",
		trip."cancellation_policy" AS "cancellationPolicy",
		trip."status",
		trip."created_at" AS "createdAt",
		trip."updated_at" AS "updatedAt",
		COALESCE((
			SELECT jsonb_agg(
				jsonb_build_object(
					'id', waypoint."id",
					'tripId', waypoint."trip_id",
					'checkpointId', waypoint."checkpoint_id",
					'type', waypoint."type",
					'name', waypoint."name",
					'location', ST_AsGeoJSON(waypoint."location"::geometry)::json,
					'dayNumber', waypoint."day_number",
					'sequenceOrder', waypoint."sequence_order",
					'plannedAt', waypoint."planned_at",
					'durationMinutes', waypoint."duration_minutes",
					'metadata', waypoint."metadata"
				)
				ORDER BY waypoint."sequence_order", waypoint."id"
			)
			FROM "trip_waypoints" waypoint
			WHERE waypoint."trip_id" = trip."id"
		), '[]'::jsonb) AS "waypoints"
	FROM "trips" trip
`;

@Injectable()
export class TripsRepository extends Repository<Trip> {
	async findRouteDependencyForUpdate(routeId: string): Promise<TripRouteDependency | null> {
		const rows = (await this.query(
			`
			SELECT "id", "host_id" AS "hostId", "status"
			FROM "trekking_routes"
			WHERE "id" = $1
			FOR UPDATE
			`,
			[routeId]
		)) as TripRouteDependency[];

		return rows[0] ?? null;
	}

	async findInvalidWaypointCheckpointIds(
		routeId: string,
		checkpointIds: string[]
	): Promise<string[]> {
		if (checkpointIds.length === 0) return [];

		const rows = (await this.query(
			`
			SELECT requested."checkpointId"
			FROM unnest($2::uuid[]) AS requested("checkpointId")
			LEFT JOIN "checkpoints" checkpoint
				ON checkpoint."id" = requested."checkpointId"
				AND checkpoint."route_id" = $1
			WHERE checkpoint."id" IS NULL
			`,
			[routeId, checkpointIds]
		)) as Array<{ checkpointId: string }>;

		return rows.map((row) => row.checkpointId);
	}

	async createDraft(input: CreateTripInput): Promise<TripResponseDto> {
		const tripRows = (await this.query(
			`
			INSERT INTO "trips" (
				"host_id",
				"route_id",
				"title",
				"description",
				"cover_image_url",
				"itinerary",
				"includes",
				"excludes",
				"trip_type",
				"duration_nights",
				"starts_at",
				"ends_at",
				"meeting_point",
				"meeting_at",
				"booking_deadline",
				"capacity_min",
				"capacity_max",
				"seats_taken",
				"is_free",
				"price_per_person",
				"province_code",
				"city_code",
				"cancellation_policy",
				"status"
			)
			VALUES (
				$1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10,
				$11, $12, ST_SetSRID(ST_GeomFromGeoJSON($13), 4326)::geography, $14,
				$15, $16, $17, 0, $18, $19, $20, $21, $22::jsonb, $23
			)
			RETURNING "id"
			`,
			[
				input.hostId,
				input.routeId,
				input.title,
				input.description,
				input.coverImageUrl,
				JSON.stringify(input.itinerary),
				JSON.stringify(input.includes),
				JSON.stringify(input.excludes),
				input.tripType,
				input.durationNights,
				input.startsAt,
				input.endsAt,
				JSON.stringify(input.meetingPoint),
				input.meetingAt,
				input.bookingDeadline,
				input.capacityMin,
				input.capacityMax,
				input.isFree,
				input.pricePerPerson,
				input.provinceCode,
				input.cityCode,
				JSON.stringify(input.cancellationPolicy),
				TripStatus.DRAFT,
			]
		)) as Array<{ id: string }>;

		const tripId = tripRows[0].id;
		for (const waypoint of input.waypoints) {
			await this.query(
				`
					INSERT INTO "trip_waypoints" (
						"trip_id",
						"checkpoint_id",
						"type",
						"name",
						"location",
						"day_number",
						"sequence_order",
						"planned_at",
						"duration_minutes",
						"metadata"
					)
					VALUES (
						$1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)::geography,
						$6, $7, $8, $9, $10::jsonb
					)
					`,
				[
					tripId,
					waypoint.checkpointId,
					waypoint.type,
					waypoint.name,
					JSON.stringify(waypoint.location),
					waypoint.dayNumber,
					waypoint.sequenceOrder,
					waypoint.plannedAt,
					waypoint.durationMinutes,
					JSON.stringify(waypoint.metadata),
				]
			);
		}

		return this.findById(tripId);
	}

	async findById(tripId: string): Promise<TripResponseDto> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."id" = $1`,
			[tripId]
		)) as TripRow[];

		return toTripResponse(rows[0]);
	}
}
