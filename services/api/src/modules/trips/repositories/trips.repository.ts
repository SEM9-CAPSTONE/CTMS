import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	type TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../../trekking-routes/entities/trekking-route.entity";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { PorterAssignedTripResponseDto } from "../dto/porter-assigned-trip-response.dto";
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

export interface LockedTripForScheduleChange {
	trip: TripResponseDto;
	hostId: string;
	routeId: string;
	status: TripStatus;
	startsAt: Date;
	endsAt: Date;
	meetingAt: Date | null;
	tripType: TripType;
	durationNights: number;
}

export interface PorterAvailabilityTripContext {
	id: string;
	hostId: string;
	routeId: string | null;
	startsAt: Date | null;
	endsAt: Date | null;
}

export interface TripRescheduleCommitmentSummary {
	bookingsPendingReconfirmation: number;
	portersPendingReconfirmation: number;
	equipmentReservationsMoved: number;
	equipmentReservationsCancelled: number;
	equipmentRefundsCreated: number;
}

export interface TripCancellationCommitmentSummary {
	bookingsCancelled: number;
	portersUnassigned: number;
	equipmentReservationsCancelled: number;
	bookingRefundsCreated: number;
}

export interface PendingReviewDeadlineCandidate {
	id: string;
	hostId: string;
	title: string;
	updatedAt: Date;
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
				ORDER BY waypoint."planned_at", waypoint."id"
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

	async updateDraft(tripId: string, input: CreateTripInput): Promise<TripResponseDto> {
		await this.query(
			`
			UPDATE "trips"
			SET
				"route_id" = $2,
				"title" = $3,
				"description" = $4,
				"cover_image_url" = $5,
				"itinerary" = $6::jsonb,
				"includes" = $7::jsonb,
				"excludes" = $8::jsonb,
				"trip_type" = $9,
				"duration_nights" = $10,
				"starts_at" = $11,
				"ends_at" = $12,
				"meeting_point" = ST_SetSRID(ST_GeomFromGeoJSON($13), 4326)::geography,
				"meeting_at" = $14,
				"booking_deadline" = $15,
				"capacity_min" = $16,
				"capacity_max" = $17,
				"price_per_person" = $18,
				"cancellation_policy" = $19::jsonb,
				"updated_at" = now()
			WHERE "id" = $1
			`,
			[
				tripId,
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
			]
		);

		await this.query(`DELETE FROM "trip_waypoints" WHERE "trip_id" = $1`, [tripId]);
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

		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load updated Trip");
		}
		return updated;
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

	async findPorterAvailabilityContext(
		tripId: string
	): Promise<PorterAvailabilityTripContext | null> {
		const rows = (await this.query(
			`SELECT
				"id",
				"host_id" AS "hostId",
				"route_id" AS "routeId",
				"starts_at" AS "startsAt",
				"ends_at" AS "endsAt"
			 FROM "trips"
			 WHERE "id" = $1`,
			[tripId]
		)) as PorterAvailabilityTripContext[];

		return rows[0] ?? null;
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

	async findPendingReviewReminderCandidates(
		reminderStartsBefore: Date,
		expiresBefore: Date
	): Promise<PendingReviewDeadlineCandidate[]> {
		return this.query(
			`
			SELECT
				trip."id",
				trip."host_id" AS "hostId",
				trip."title",
				trip."updated_at" AS "updatedAt"
			FROM "trips" trip
			WHERE trip."status" = $1
				AND trip."updated_at" <= $2
				AND trip."updated_at" > $3
				AND NOT EXISTS (
					SELECT 1
					FROM "audit_logs" audit
					WHERE audit."target_type" = 'trip'
						AND audit."target_id" = trip."id"
						AND audit."action" = 'trip.review.reminder_sent'
				)
			ORDER BY trip."updated_at" ASC, trip."id" ASC
			`,
			[TripStatus.PENDING_APPROVAL, reminderStartsBefore, expiresBefore]
		);
	}

	async findExpiredPendingReviewCandidates(
		expiresBefore: Date
	): Promise<PendingReviewDeadlineCandidate[]> {
		return this.query(
			`
			SELECT
				trip."id",
				trip."host_id" AS "hostId",
				trip."title",
				trip."updated_at" AS "updatedAt"
			FROM "trips" trip
			WHERE trip."status" = $1
				AND trip."updated_at" <= $2
			ORDER BY trip."updated_at" ASC, trip."id" ASC
			`,
			[TripStatus.PENDING_APPROVAL, expiresBefore]
		);
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

	findAssignedTripsByPorter(porterId: string): Promise<PorterAssignedTripResponseDto[]> {
		return this.query(
			`SELECT
				trip."id" AS "tripId",
				trip."title",
				trip."status",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt"
			 FROM "trip_porters" assignment
			 INNER JOIN "trips" trip ON trip."id" = assignment."trip_id"
			 WHERE assignment."porter_id" = $1
			   AND assignment."status" = 'assigned'
			 ORDER BY trip."starts_at" ASC, trip."id" ASC`,
			[porterId]
		);
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

	async findByIdForScheduleChange(tripId: string): Promise<LockedTripForScheduleChange | null> {
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
			startsAt: row.startsAt,
			endsAt: row.endsAt,
			meetingAt: row.meetingAt,
			tripType: row.tripType,
			durationNights: Number(row.durationNights),
		};
	}

	async reschedulePublishedTrip(
		tripId: string,
		newStartsAt: Date,
		newEndsAt: Date,
		rescheduledAt: Date,
		reconfirmationDeadline: Date
	): Promise<TripRescheduleCommitmentSummary> {
		await this.query(
			`
			UPDATE "trips"
			SET
				"starts_at" = $2,
				"ends_at" = $3,
				"rescheduled_at" = $4,
				"updated_at" = now()
			WHERE "id" = $1
			`,
			[tripId, newStartsAt, newEndsAt, rescheduledAt]
		);

		const bookingRows = (await this.query(
			`
			UPDATE "bookings"
			SET
				"status" = 'pending_reconfirmation',
				"trip_starts_at_snapshot" = $2,
				"trip_ends_at_snapshot" = $3,
				"reconfirmation_deadline" = $4,
				"reconfirmed_at" = NULL,
				"declined_at" = NULL
			WHERE "trip_id" = $1
				AND "status" IN ('confirmed', 'pending_payment')
			RETURNING "id"
			`,
			[tripId, newStartsAt, newEndsAt, reconfirmationDeadline]
		)) as Array<{ id: string }>;

		const porterRows = (await this.query(
			`
			UPDATE "trip_porters"
			SET
				"status" = 'pending_reconfirmation',
				"reconfirmation_deadline" = $2,
				"reconfirmed_at" = NULL,
				"declined_at" = NULL
			WHERE "trip_id" = $1
				AND "status" = 'assigned'
			RETURNING "porter_id" AS "porterId"
			`,
			[tripId, reconfirmationDeadline]
		)) as Array<{ porterId: string }>;

		const rentalStartDate = toDateOnly(newStartsAt);
		const rentalEndDate = toDateOnly(newEndsAt);
		const reservationRows = (await this.query(
			`
			SELECT
				er."id",
				er."booking_item_id" AS "bookingItemId",
				er."equipment_catalog_item_id" AS "equipmentCatalogItemId",
				er."quantity",
				bi."booking_id" AS "bookingId",
				bi."total_price"::text AS "totalPrice",
				eci."quantity_total" AS "quantityTotal",
				COALESCE(overlap."reservedQuantity", 0)::int AS "reservedQuantity"
			FROM "equipment_reservations" er
			INNER JOIN "booking_items" bi ON bi."id" = er."booking_item_id"
			INNER JOIN "bookings" b ON b."id" = bi."booking_id"
			INNER JOIN "equipment_catalog_items" eci ON eci."id" = er."equipment_catalog_item_id"
			LEFT JOIN LATERAL (
				SELECT COALESCE(SUM(other_er."quantity"), 0) AS "reservedQuantity"
				FROM "equipment_reservations" other_er
				WHERE other_er."equipment_catalog_item_id" = er."equipment_catalog_item_id"
					AND other_er."status" = 'active'
					AND other_er."id" <> er."id"
					AND other_er."rental_start_date" <= $3::date
					AND other_er."rental_end_date" >= $2::date
			) overlap ON TRUE
			WHERE b."trip_id" = $1
				AND er."status" = 'active'
			FOR UPDATE OF er, eci
			`,
			[tripId, rentalStartDate, rentalEndDate]
		)) as Array<{
			id: string;
			bookingItemId: string;
			equipmentCatalogItemId: string;
			quantity: number | string;
			bookingId: string;
			totalPrice: string;
			quantityTotal: number | string;
			reservedQuantity: number | string;
		}>;

		let equipmentReservationsMoved = 0;
		let equipmentReservationsCancelled = 0;
		let equipmentRefundsCreated = 0;

		for (const reservation of reservationRows) {
			const available = Number(reservation.quantityTotal) - Number(reservation.reservedQuantity);
			if (Number(reservation.quantity) <= available) {
				await this.query(
					`
					UPDATE "equipment_reservations"
					SET "rental_start_date" = $2::date, "rental_end_date" = $3::date
					WHERE "id" = $1
					`,
					[reservation.id, rentalStartDate, rentalEndDate]
				);
				equipmentReservationsMoved += 1;
				continue;
			}

			await this.query(
				`
				UPDATE "equipment_reservations"
				SET
					"status" = 'cancelled',
					"cancelled_at" = $2,
					"cancellation_reason" = 'reschedule_equipment_unavailable'
				WHERE "id" = $1
				`,
				[reservation.id, rescheduledAt]
			);
			equipmentReservationsCancelled += 1;
			equipmentRefundsCreated += await this.createIdempotentRefund(
				reservation.bookingId,
				reservation.totalPrice,
				`ctms-027:reschedule:${tripId}:equipment:${reservation.bookingItemId}`,
				"reschedule_equipment_unavailable"
			);
		}

		return {
			bookingsPendingReconfirmation: bookingRows.length,
			portersPendingReconfirmation: porterRows.length,
			equipmentReservationsMoved,
			equipmentReservationsCancelled,
			equipmentRefundsCreated,
		};
	}

	async cancelTripWithCommitments(
		tripId: string,
		cancelledAt: Date,
		reason: string
	): Promise<TripCancellationCommitmentSummary> {
		await this.query(
			`
			UPDATE "trips"
			SET
				"status" = $2,
				"cancelled_at" = $3,
				"cancellation_reason" = $4,
				"updated_at" = now()
			WHERE "id" = $1
			`,
			[tripId, TripStatus.CANCELLED, cancelledAt, reason]
		);

		const bookingRows = (await this.query(
			`
			UPDATE "bookings"
			SET
				"status" = 'cancelled',
				"declined_at" = $2
			WHERE "trip_id" = $1
				AND "status" IN ('confirmed', 'pending_payment', 'pending_reconfirmation')
			RETURNING "id", "total_amount"::text AS "totalAmount"
			`,
			[tripId, cancelledAt]
		)) as Array<{ id: string; totalAmount: string | null }>;

		const porterRows = (await this.query(
			`
			UPDATE "trip_porters"
			SET
				"status" = 'unassigned',
				"declined_at" = $2
			WHERE "trip_id" = $1
				AND "status" IN ('assigned', 'pending_reconfirmation')
			RETURNING "porter_id" AS "porterId"
			`,
			[tripId, cancelledAt]
		)) as Array<{ porterId: string }>;

		const equipmentRows = (await this.query(
			`
			UPDATE "equipment_reservations" er
			SET
				"status" = 'cancelled',
				"cancelled_at" = $2,
				"cancellation_reason" = 'trip_cancelled'
			FROM "booking_items" bi
			INNER JOIN "bookings" b ON b."id" = bi."booking_id"
			WHERE er."booking_item_id" = bi."id"
				AND b."trip_id" = $1
				AND er."status" = 'active'
			RETURNING er."id"
			`,
			[tripId, cancelledAt]
		)) as Array<{ id: string }>;

		let bookingRefundsCreated = 0;
		for (const booking of bookingRows) {
			if (booking.totalAmount) {
				bookingRefundsCreated += await this.createIdempotentRefund(
					booking.id,
					booking.totalAmount,
					`ctms-027:trip-cancel:${tripId}:booking:${booking.id}`,
					"trip_cancelled_by_host"
				);
			}
		}

		await this.recomputeSeatsTaken(tripId);

		return {
			bookingsCancelled: bookingRows.length,
			portersUnassigned: porterRows.length,
			equipmentReservationsCancelled: equipmentRows.length,
			bookingRefundsCreated,
		};
	}

	private async createIdempotentRefund(
		bookingId: string,
		amount: string,
		idempotencyKey: string,
		reason: string
	): Promise<number> {
		const rows = (await this.query(
			`
			WITH parent_charge AS (
				SELECT "id"
				FROM "payments"
				WHERE "booking_id" = $1
					AND "type" = 'charge'
					AND "status" = 'succeeded'
				ORDER BY "created_at" DESC
				LIMIT 1
			),
			inserted AS (
				INSERT INTO "payments" (
					"booking_id",
					"amount",
					"type",
					"status",
					"idempotency_key",
					"request_fingerprint",
					"parent_payment_id",
					"provider_reference"
				)
				SELECT
					$1,
					$2::numeric,
					'refund',
					'pending',
					$3,
					substr(md5($3 || ':' || $2) || md5($2 || ':' || $3), 1, 64),
					parent_charge."id",
					$4
				FROM parent_charge
				WHERE $2::numeric > 0
				ON CONFLICT ("booking_id", "idempotency_key")
					WHERE "idempotency_key" IS NOT NULL
				DO NOTHING
				RETURNING "id"
			)
			SELECT COUNT(*)::int AS "createdCount" FROM inserted
			`,
			[bookingId, amount, idempotencyKey, reason]
		)) as Array<{ createdCount: number | string }>;

		return Number(rows[0]?.createdCount ?? 0);
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

function toDateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}
