import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	type TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../../trekking-routes/entities/trekking-route.entity";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type {
	TripResponseDto,
	TripSummaryResponseDto,
	TripWaypointResponseDto,
} from "../dto/trip-response.dto";
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
	capacityMax: number | null;
	pricePerPerson: number;
	cancellationPolicy: Record<string, unknown> | null;
	waypoints: CreateTripWaypointInput[];
}

export interface TripRouteDependency {
	id: string;
	hostId: string;
	status: string;
}

export interface LockedTripForWaypointConfiguration {
	trip: TripResponseDto;
	hostId: string;
	routeId: string;
	status: TripStatus;
}

export interface LockedTripForReview {
	trip: TripResponseDto;
	routeId: string;
	status: TripStatus;
}

/**
 * CTMS-024 – Prevent Trip Overbooking.
 * Minimal projection locked FOR UPDATE to validate and increment seats_taken
 * atomically within a booking transaction (BR-068, BR-071).
 */
export interface LockedTripForBooking {
	id: string;
	routeId: string;
	routeStatus: TrekkingRouteStatus;
	capacityMin: number;
	capacityMax: number | null;
	seatsTaken: number;
	status: TripStatus;
	bookingDeadline: Date;
	startsAt: Date;
	endsAt: Date;
	pricePerPerson: string;
	cancellationPolicy: Record<string, unknown> | null;
}

export interface SearchPublishedTripsFilter {
	search?: string;
	tripType?: TripType;
	difficulty?: TrekkingRouteDifficulty;
	startDate?: Date;
	endDate?: Date;
	minPrice?: number;
	maxPrice?: number;
	routeId?: string;
	province?: string;
	city?: string;
	page: number;
	limit: number;
}

interface TripSummaryRow {
	id: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	tripType: TripType;
	durationNights: number | string;
	startsAt: Date;
	endsAt: Date;
	meetingPoint: GeoPoint;
	meetingAt: Date | null;
	bookingDeadline: Date;
	capacityMin: number | string;
	capacityMax: number | string | null;
	seatsTaken: number | string;
	pricePerPerson: number | string;
	status: TripStatus;
	createdAt: Date;
	updatedAt: Date;
	difficulty: TrekkingRouteDifficulty | null;
	routeStatus: TrekkingRouteStatus | null;
	weatherRiskLevel: RiskLevel | null;
}

interface TripRow extends TripSummaryRow {
	hostId: string;
	host?: {
		id: string;
		fullName?: string | null;
		email?: string | null;
		phone?: string | null;
		bio?: string | null;
	} | null;
	routeId: string;
	itinerary: Record<string, unknown> | null;
	includes: Record<string, unknown> | null;
	excludes: Record<string, unknown> | null;
	cancellationPolicy: Record<string, unknown> | null;
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

function computeIsBookable(
	status: TripStatus,
	routeStatus: TrekkingRouteStatus | null,
	endsAt: Date,
	bookingDeadline: Date,
	capacityMax: number | null,
	seatsTaken: number
): boolean {
	const now = Date.now();
	return (
		status === TripStatus.PUBLISHED &&
		routeStatus === TrekkingRouteStatus.ACTIVE &&
		new Date(endsAt).getTime() > now &&
		new Date(bookingDeadline).getTime() > now &&
		(capacityMax === null || seatsTaken < capacityMax)
	);
}

function computeRemainingSeats(capacityMax: number | null, seatsTaken: number): number | null {
	if (capacityMax == null) return null;
	return Math.max(0, capacityMax - seatsTaken);
}

function toWaypointResponse(row: TripWaypointRow): TripWaypointResponseDto {
	return {
		...row,
		dayNumber: Number(row.dayNumber),
		sequenceOrder: Number(row.sequenceOrder),
		durationMinutes: row.durationMinutes == null ? null : Number(row.durationMinutes),
	};
}

function toTripSummaryResponse(row: TripSummaryRow): TripSummaryResponseDto {
	const capacityMax = row.capacityMax == null ? null : Number(row.capacityMax);
	const seatsTaken = Number(row.seatsTaken);
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		coverImageUrl: row.coverImageUrl,
		tripType: row.tripType,
		durationNights: Number(row.durationNights),
		startsAt: row.startsAt,
		endsAt: row.endsAt,
		meetingPoint: row.meetingPoint,
		meetingAt: row.meetingAt,
		bookingDeadline: row.bookingDeadline,
		capacityMin: Number(row.capacityMin),
		capacityMax,
		seatsTaken,
		remainingSeats: computeRemainingSeats(capacityMax, seatsTaken),
		pricePerPerson: Number(row.pricePerPerson),
		status: row.status,
		difficulty: row.difficulty ?? null,
		weatherRiskLevel: row.weatherRiskLevel ?? null,
		isBookable: computeIsBookable(
			row.status,
			row.routeStatus,
			row.endsAt,
			row.bookingDeadline,
			capacityMax,
			seatsTaken
		),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toTripResponse(row: TripRow): TripResponseDto {
	const capacityMax = row.capacityMax == null ? null : Number(row.capacityMax);
	const seatsTaken = Number(row.seatsTaken);
	return {
		id: row.id,
		hostId: row.hostId,
		host: row.host ?? null,
		routeId: row.routeId,
		title: row.title,
		description: row.description,
		coverImageUrl: row.coverImageUrl,
		itinerary: row.itinerary,
		includes: row.includes,
		excludes: row.excludes,
		tripType: row.tripType,
		durationNights: Number(row.durationNights),
		startsAt: row.startsAt,
		endsAt: row.endsAt,
		meetingPoint: row.meetingPoint,
		meetingAt: row.meetingAt,
		bookingDeadline: row.bookingDeadline,
		capacityMin: Number(row.capacityMin),
		capacityMax,
		seatsTaken,
		remainingSeats: computeRemainingSeats(capacityMax, seatsTaken),
		pricePerPerson: Number(row.pricePerPerson),
		cancellationPolicy: row.cancellationPolicy,
		status: row.status,
		difficulty: row.difficulty ?? null,
		weatherRiskLevel: row.weatherRiskLevel ?? null,
		isBookable: computeIsBookable(
			row.status,
			row.routeStatus,
			row.endsAt,
			row.bookingDeadline,
			capacityMax,
			seatsTaken
		),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		waypoints: row.waypoints.map(toWaypointResponse),
	};
}

const TRIP_SELECT = `
	SELECT
		trip."id",
		trip."host_id" AS "hostId",
		CASE
			WHEN u."id" IS NOT NULL THEN
				jsonb_build_object(
					'id', u."id",
					'fullName', u."full_name",
					'email', u."email",
					'phone', u."phone",
					'bio', u."bio"
				)
			ELSE NULL
		END AS "host",
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
		trip."price_per_person" AS "pricePerPerson",
		trip."cancellation_policy" AS "cancellationPolicy",
		trip."status",
		trip."created_at" AS "createdAt",
		trip."updated_at" AS "updatedAt",
		route."difficulty" AS "difficulty",
		route."status" AS "routeStatus",
		(
			SELECT wra."risk_level"
			FROM "weather_risk_assessments" wra
			WHERE wra."route_id" = trip."route_id"
			ORDER BY wra."created_at" DESC
			LIMIT 1
		) AS "weatherRiskLevel",
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
	LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
	LEFT JOIN "users" u ON u."id" = trip."host_id"
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
				"price_per_person",
				"cancellation_policy",
				"status"
			)
			VALUES (
				$1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10,
				$11, $12, ST_SetSRID(ST_GeomFromGeoJSON($13), 4326)::geography, $14,
				$15, $16, $17, 0, $18, $19::jsonb, $20
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
				input.pricePerPerson,
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

		const created = await this.findById(tripId);
		if (!created) {
			throw new Error("Failed to load created Trip");
		}
		return created;
	}

	async findByIdForWaypointConfiguration(
		tripId: string
	): Promise<LockedTripForWaypointConfiguration | null> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."id" = $1
			FOR UPDATE OF trip`,
			[tripId]
		)) as TripRow[];

		const row = rows[0];
		if (!row) return null;

		return {
			trip: toTripResponse(row),
			hostId: row.hostId,
			routeId: row.routeId,
			status: row.status,
		};
	}

	async replaceWaypointsAndSubmitForApproval(
		tripId: string,
		waypoints: CreateTripWaypointInput[]
	): Promise<TripResponseDto> {
		await this.query(`DELETE FROM "trip_waypoints" WHERE "trip_id" = $1`, [tripId]);

		for (const waypoint of waypoints) {
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

		await this.query(
			`
			UPDATE "trips"
			SET "status" = $2, "updated_at" = now()
			WHERE "id" = $1
			`,
			[tripId, TripStatus.PENDING_APPROVAL]
		);

		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load updated Trip");
		}
		return updated;
	}

	async findById(tripId: string): Promise<TripResponseDto | null> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."id" = $1`,
			[tripId]
		)) as TripRow[];

		if (!rows[0]) return null;
		return toTripResponse(rows[0]);
	}

	async findPendingReview(): Promise<TripResponseDto[]> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."status" = $1
			ORDER BY trip."created_at" ASC, trip."id" ASC`,
			[TripStatus.PENDING_APPROVAL]
		)) as TripRow[];

		return rows.map(toTripResponse);
	}

	async findTripsByHost(hostId: string): Promise<TripResponseDto[]> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."host_id" = $1
			ORDER BY trip."created_at" DESC`,
			[hostId]
		)) as TripRow[];

		return rows.map(toTripResponse);
	}

	async findByIdForReview(tripId: string): Promise<LockedTripForReview | null> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."id" = $1
			FOR UPDATE OF trip`,
			[tripId]
		)) as TripRow[];

		const row = rows[0];
		if (!row) return null;

		return {
			trip: toTripResponse(row),
			routeId: row.routeId,
			status: row.status,
		};
	}

	async findRouteStatus(routeId: string): Promise<string | null> {
		const rows = (await this.query(`SELECT "status" FROM "trekking_routes" WHERE "id" = $1`, [
			routeId,
		])) as Array<{ status: string }>;

		return rows[0]?.status ?? null;
	}

	async updateStatus(tripId: string, status: TripStatus): Promise<TripResponseDto> {
		await this.query(
			`
			UPDATE "trips"
			SET "status" = $2, "updated_at" = now()
			WHERE "id" = $1
			`,
			[tripId, status]
		);

		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load updated Trip");
		}
		return updated;
	}

	async searchPublishedTrips(
		filters: SearchPublishedTripsFilter
	): Promise<{ items: TripSummaryResponseDto[]; total: number }> {
		const conditions: string[] = [`trip."status" = 'published'`, `trip."ends_at" > now()`];
		const params: unknown[] = [];

		if (filters.search) {
			params.push(`%${filters.search}%`);
			conditions.push(
				`(trip."title" ILIKE $${params.length} OR trip."description" ILIKE $${params.length})`
			);
		}

		if (filters.tripType) {
			params.push(filters.tripType);
			conditions.push(`trip."trip_type" = $${params.length}`);
		}

		if (filters.difficulty) {
			params.push(filters.difficulty);
			conditions.push(`route."difficulty" = $${params.length}`);
		}

		if (filters.startDate) {
			params.push(filters.startDate);
			conditions.push(`trip."starts_at" >= $${params.length}`);
		}

		if (filters.endDate) {
			params.push(filters.endDate);
			conditions.push(`trip."starts_at" <= $${params.length}`);
		}

		if (filters.minPrice != null) {
			params.push(filters.minPrice);
			conditions.push(`trip."price_per_person" >= $${params.length}`);
		}

		if (filters.maxPrice != null) {
			params.push(filters.maxPrice);
			conditions.push(`trip."price_per_person" <= $${params.length}`);
		}

		if (filters.routeId) {
			params.push(filters.routeId);
			conditions.push(`trip."route_id" = $${params.length}`);
		}

		if (filters.province) {
			params.push(`%${filters.province}%`);
			conditions.push(
				`(trip."title" ILIKE $${params.length} OR trip."description" ILIKE $${params.length})`
			);
		}

		if (filters.city) {
			params.push(`%${filters.city}%`);
			conditions.push(
				`(trip."title" ILIKE $${params.length} OR trip."description" ILIKE $${params.length})`
			);
		}

		const whereClause = `WHERE ${conditions.join(" AND ")}`;

		const countResult = (await this.query(
			`
			SELECT COUNT(trip."id")::int AS total
			FROM "trips" trip
			LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
			${whereClause}
			`,
			params
		)) as Array<{ total: number | string }>;
		const total = Number(countResult[0]?.total ?? 0);

		const offset = (filters.page - 1) * filters.limit;
		params.push(filters.limit);
		const limitParamIndex = params.length;
		params.push(offset);
		const offsetParamIndex = params.length;

		const rows = (await this.query(
			`
			SELECT
				trip."id",
				trip."title",
				trip."description",
				trip."cover_image_url" AS "coverImageUrl",
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
				trip."price_per_person" AS "pricePerPerson",
				trip."status",
				trip."created_at" AS "createdAt",
				trip."updated_at" AS "updatedAt",
				route."difficulty" AS "difficulty",
				route."status" AS "routeStatus",
				(
					SELECT wra."risk_level"
					FROM "weather_risk_assessments" wra
					WHERE wra."route_id" = trip."route_id"
					ORDER BY wra."created_at" DESC
					LIMIT 1
				) AS "weatherRiskLevel"
			FROM "trips" trip
			LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
			${whereClause}
			ORDER BY trip."starts_at" ASC, trip."id" ASC
			LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
			`,
			params
		)) as TripSummaryRow[];

		return {
			items: rows.map(toTripSummaryResponse),
			total,
		};
	}

	/**
	 * CTMS-024 – BR-068.
	 * Acquires a row-level advisory lock on the trips row for the duration of
	 * the caller's transaction so that concurrent booking writes are serialised
	 * for the same trip_id.  Must be called inside an active TypeORM transaction
	 * (manager.withRepository).
	 */
	async findByIdForBooking(tripId: string): Promise<LockedTripForBooking | null> {
		const rows = (await this.query(
			`
			SELECT
				trip."id",
				trip."route_id" AS "routeId",
				route."status" AS "routeStatus",
				trip."capacity_min" AS "capacityMin",
				trip."capacity_max" AS "capacityMax",
				trip."seats_taken"  AS "seatsTaken",
				trip."status",
				trip."booking_deadline" AS "bookingDeadline",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				trip."price_per_person" AS "pricePerPerson",
				trip."cancellation_policy" AS "cancellationPolicy"
			FROM "trips" trip
			INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			WHERE trip."id" = $1
			FOR UPDATE OF trip, route
			`,
			[tripId]
		)) as Array<{
			id: string;
			routeId: string;
			routeStatus: TrekkingRouteStatus;
			capacityMin: number | string;
			capacityMax: number | string | null;
			seatsTaken: number | string;
			status: TripStatus;
			bookingDeadline: Date;
			startsAt: Date;
			endsAt: Date;
			pricePerPerson: string;
			cancellationPolicy: Record<string, unknown> | null;
		}>;

		const row = rows[0];
		if (!row) return null;

		return {
			id: row.id,
			routeId: row.routeId,
			routeStatus: row.routeStatus,
			capacityMin: Number(row.capacityMin),
			capacityMax: row.capacityMax == null ? null : Number(row.capacityMax),
			seatsTaken: Number(row.seatsTaken),
			status: row.status,
			bookingDeadline: row.bookingDeadline,
			startsAt: row.startsAt,
			endsAt: row.endsAt,
			pricePerPerson: row.pricePerPerson,
			cancellationPolicy: row.cancellationPolicy,
		};
	}

	/**
	 * CTMS-024 – BR-067, BR-071, BR-072.
	 * Atomically adjusts seats_taken by `delta` (+N for reserve, -N for release).
	 * The DB constraint CHK_trips_seats_taken (seats_taken >= 0 AND seats_taken
	 * <= capacity_max) acts as the final overbooking guard.  If the constraint
	 * is violated the UPDATE throws and the caller's transaction is rolled back
	 * cleanly (BR-177).
	 *
	 * Must be called inside an active TypeORM transaction after
	 * `findByIdForBooking` has acquired the row lock (BR-068).
	 */
	async adjustSeatsTaken(tripId: string, delta: number): Promise<void> {
		await this.query(
			`
			UPDATE "trips"
			SET "seats_taken" = "seats_taken" + $2,
			    "updated_at"  = now()
			WHERE "id" = $1
			`,
			[tripId, delta]
		);
	}

	/**
	 * CTMS-024 – BR-067, BR-069, BR-070.
	 * Reconciles seats_taken from the authoritative bookings table by calling
	 * the `recompute_trip_seats_taken` database function.  Used after a booking
	 * cancellation, expiry, or any compensating rollback where the delta-based
	 * counter may be out of sync.  Must be called inside a transaction that
	 * already holds the row lock on the trip (FOR UPDATE).
	 */
	async recomputeSeatsTaken(tripId: string): Promise<void> {
		await this.query("SELECT recompute_trip_seats_taken($1)", [tripId]);
	}
}
