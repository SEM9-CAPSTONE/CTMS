import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	type TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../../trekking-routes/entities/trekking-route.entity";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type {
	HostPorterAssignmentDto,
	HostPorterAssignmentTripDto,
} from "../dto/host-porter-assignment-response.dto";
import type { TripReviewOutcome } from "../dto/list-trip-reviews-query.dto";
import type { PorterAssignedTripResponseDto } from "../dto/porter-assigned-trip-response.dto";
import type {
	PorterRecordedWeather,
	PorterTripOperationsResponseDto,
} from "../dto/porter-trip-operations-response.dto";
import type {
	AdminTripReviewResponseDto,
	SubmittedWeatherForecastSummaryDto,
	TripRegistrationRiskResponseDto,
	TripResponseDto,
	TripSummaryResponseDto,
	TripWaypointResponseDto,
} from "../dto/trip-response.dto";
import type { WaypointType } from "../entities/trip-waypoint.entity";
import type { GeoPoint, Trip, TripType } from "../entities/trip.entity";
import { TripStatus } from "../entities/trip.entity";
import {
	PORTER_TRIP_OPERATIONS_QUERY,
	PORTER_VISIBLE_TRIP_STATUSES_SQL,
} from "./porter-trip-operations.query";

export interface PorterTripOperationsRow
	extends Omit<PorterTripOperationsResponseDto, "weather" | "offlinePackage" | "retrievedAt"> {
	retrievedAt: Date;
	recordedWeather: PorterRecordedWeather | null;
}

export interface CreateTripWaypointInput {
	/** Preserves an existing waypoint id when a draft's waypoints are rewritten. */
	id?: string;
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

/** CTMS-036. Minimal locked projection used by the auto-cancel evaluation transaction. */
export interface LockedTripForAutoCancelEvaluation {
	id: string;
	status: TripStatus;
	bookingDeadline: Date;
	capacityMin: number;
	participationEvaluatedAt: Date | null;
}

export interface PorterAvailabilityTripContext {
	id: string;
	hostId: string;
	routeId: string | null;
	startsAt: Date | null;
	endsAt: Date | null;
	status: TripStatus;
	/** Legacy projection field; candidate search no longer rejects Trips with existing Porters. */
	hasActivePorter?: boolean;
}

export interface TripRescheduleCommitmentSummary {
	bookingsPendingReconfirmation: number;
	portersPendingReconfirmation: number;
	equipmentReservationsMoved: number;
	equipmentReservationsCancelled: number;
	equipmentRefundsCreated: number;
}

export interface CancelledBookingCommitment {
	id: string;
	userId: string;
	totalAmount: string | null;
}

export interface TripCancellationCommitmentSummary {
	bookingsCancelled: number;
	portersUnassigned: number;
	equipmentReservationsCancelled: number;
	bookingRefundsCreated: number;
	cancelledBookings: CancelledBookingCommitment[];
}

export interface CancelTripWithCommitmentsOptions {
	/** Prefix for the per-Booking refund idempotency key; keeps CTMS-036's auto-cancel
	 *  refund obligations distinguishable from CTMS-027's host-cancel ones. */
	refundIdempotencyPrefix?: string;
}

export interface PendingReviewDeadlineCandidate {
	id: string;
	hostId: string;
	title: string;
	updatedAt: Date;
}

interface HostPorterAssignmentRow {
	tripId: string;
	title: string;
	tripStatus: TripStatus;
	startsAt: Date;
	endsAt: Date;
	porterId: string;
	displayName: string | null;
	email: string | null;
	assignmentStatus: HostPorterAssignmentDto["status"];
	assignedAt: Date | null;
	reconfirmationDeadline: Date | null;
	reconfirmedAt: Date | null;
	declinedAt: Date | null;
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
	registrationRisk?: TripRegistrationRiskResponseDto | null;
}

interface TripRow extends TripSummaryRow {
	reviewOutcome?: Exclude<TripReviewOutcome, TripReviewOutcome.ALL>;
	reviewedAt?: Date | null;
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
	cancellationReason: string | null;
	cancelledAt: Date | null;
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
	const registrationRisk = row.registrationRisk ?? {
		status: "unavailable" as const,
		assessmentId: null,
		level: null,
		assessedAt: null,
		ruleVersionId: null,
		factors: [],
		advice: null,
		recommendations: [],
	};
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
		cancellationReason: row.cancellationReason,
		cancelledAt: row.cancelledAt,
		difficulty: row.difficulty ?? null,
		weatherRiskLevel: row.weatherRiskLevel ?? null,
		registrationRisk,
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

function toAdminTripReviewResponse(row: TripRow): AdminTripReviewResponseDto {
	return {
		...toTripResponse(row),
		reviewOutcome: row.reviewOutcome as Exclude<TripReviewOutcome, TripReviewOutcome.ALL>,
		reviewedAt: row.reviewedAt ?? null,
	};
}

const TRIP_REVIEW_OUTCOME_EXPRESSION = `
	CASE
		WHEN trip."status" = 'pending_approval' THEN 'pending'
		WHEN latest_review."action" = 'trip.approved' THEN 'approved'
		WHEN trip."status" = 'draft'
			AND latest_review."action" = 'trip.declined'
		THEN 'returned_for_revision'
		WHEN trip."status" = 'rejected'
			AND latest_review."action" = 'trip.auto_rejected'
		THEN 'auto_rejected'
		ELSE NULL
	END
`;

const LATEST_TRIP_REVIEW_JOIN = `
	LEFT JOIN LATERAL (
		SELECT audit."action", audit."created_at"
		FROM "audit_logs" audit
		WHERE audit."target_type" = 'trip'
			AND audit."target_id" = trip."id"
			AND audit."action" IN (
				'trip.submitted_for_approval',
				'trip.approved',
				'trip.declined',
				'trip.auto_rejected'
			)
		ORDER BY audit."created_at" DESC, audit."id" DESC
		LIMIT 1
	) latest_review ON TRUE
`;

function buildTripSelect(reviewColumns = "", reviewJoin = ""): string {
	return `
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
		${reviewColumns}
		trip."cancellation_reason" AS "cancellationReason",
		trip."cancelled_at" AS "cancelledAt",
		trip."created_at" AS "createdAt",
		trip."updated_at" AS "updatedAt",
		route."difficulty" AS "difficulty",
		route."status" AS "routeStatus",
		risk."riskLevel" AS "weatherRiskLevel",
		CASE
			WHEN risk."assessmentId" IS NULL THEN jsonb_build_object(
				'status', 'unavailable',
				'assessmentId', NULL,
				'level', NULL,
				'assessedAt', NULL,
				'ruleVersionId', NULL,
				'factors', '[]'::jsonb,
				'advice', NULL,
				'recommendations', '[]'::jsonb
			)
			ELSE jsonb_build_object(
				'status', 'available',
				'assessmentId', risk."assessmentId",
				'level', risk."riskLevel",
				'assessedAt', risk."assessedAt",
				'ruleVersionId', risk."ruleVersionId",
				'factors', risk."factors",
				'advice', advice."adviceText",
				'recommendations', COALESCE(advice."actions", '[]'::jsonb)
			)
		END AS "registrationRisk",
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
	${reviewJoin}
	LEFT JOIN LATERAL (
		SELECT
			wra."id" AS "assessmentId",
			wra."risk_level" AS "riskLevel",
			wra."created_at" AS "assessedAt",
			wra."rule_version_id" AS "ruleVersionId",
			jsonb_build_array(
				jsonb_build_object(
					'key', 'rainfall',
					'label', 'Rainfall',
					'value', wra."criteria_scores"->'rainfall'->'value',
					'level', wra."criteria_scores"->'rainfall'->'level',
					'weight', wra."criteria_scores"->'rainfall'->'weight',
					'score', wra."criteria_scores"->'rainfall'->'score'
				),
				jsonb_build_object(
					'key', 'wind',
					'label', 'Wind',
					'value', wra."criteria_scores"->'wind'->'value',
					'level', wra."criteria_scores"->'wind'->'level',
					'weight', wra."criteria_scores"->'wind'->'weight',
					'score', wra."criteria_scores"->'wind'->'score'
				),
				jsonb_build_object(
					'key', 'temperature',
					'label', 'Temperature',
					'value', wra."criteria_scores"->'temperature'->'value',
					'level', wra."criteria_scores"->'temperature'->'level',
					'weight', wra."criteria_scores"->'temperature'->'weight',
					'score', wra."criteria_scores"->'temperature'->'score'
				),
				jsonb_build_object(
					'key', 'visibility',
					'label', 'Visibility',
					'value', wra."criteria_scores"->'visibility'->'value',
					'level', wra."criteria_scores"->'visibility'->'level',
					'weight', wra."criteria_scores"->'visibility'->'weight',
					'score', wra."criteria_scores"->'visibility'->'score'
				),
				jsonb_build_object(
					'key', 'thunderstorm',
					'label', 'Thunderstorm',
					'value', wra."criteria_scores"->'thunderstorm'->'value',
					'level', wra."criteria_scores"->'thunderstorm'->'level',
					'weight', wra."criteria_scores"->'thunderstorm'->'weight',
					'score', wra."criteria_scores"->'thunderstorm'->'score'
				)
			) AS "factors"
		FROM "weather_risk_assessments" wra
		WHERE wra."route_id" = trip."route_id"
		ORDER BY wra."created_at" DESC, wra."id" DESC
		LIMIT 1
	) risk ON TRUE
	LEFT JOIN LATERAL (
		SELECT wa."advice_text" AS "adviceText", wa."actions"
		FROM "weather_advice" wa
		WHERE wa."assessment_id" = risk."assessmentId"
		ORDER BY wa."created_at" DESC
		LIMIT 1
	) advice ON TRUE
`;
}

const TRIP_SELECT = buildTripSelect();
const ADMIN_TRIP_SELECT = buildTripSelect(
	`${TRIP_REVIEW_OUTCOME_EXPRESSION} AS "reviewOutcome",
		latest_review."created_at" AS "reviewedAt",`,
	LATEST_TRIP_REVIEW_JOIN
);

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

		await this.writeWaypoints(tripId, input.waypoints);

		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load updated Trip");
		}
		return updated;
	}

	/** Replaces a draft Trip's waypoints, keeping the ids of waypoints that already existed. */
	async saveDraftWaypoints(
		tripId: string,
		waypoints: CreateTripWaypointInput[]
	): Promise<TripResponseDto> {
		await this.writeWaypoints(tripId, waypoints);
		await this.query(`UPDATE "trips" SET "updated_at" = now() WHERE "id" = $1`, [tripId]);
		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load updated Trip");
		}
		return updated;
	}

	async submitDraftForApproval(tripId: string): Promise<TripResponseDto> {
		await this.query(
			`UPDATE "trips" SET "status" = $2, "updated_at" = now() WHERE "id" = $1 AND "status" = $3`,
			[tripId, TripStatus.PENDING_APPROVAL, TripStatus.DRAFT]
		);
		const updated = await this.findById(tripId);
		if (!updated) {
			throw new Error("Failed to load submitted Trip");
		}
		return updated;
	}

	private async writeWaypoints(
		tripId: string,
		waypoints: CreateTripWaypointInput[]
	): Promise<void> {
		await this.query(`DELETE FROM "trip_waypoints" WHERE "trip_id" = $1`, [tripId]);
		for (const waypoint of waypoints) {
			await this.query(
				`
				INSERT INTO "trip_waypoints" (
					"id",
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
					COALESCE($11::uuid, gen_random_uuid()),
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
					waypoint.id ?? null,
				]
			);
		}
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
				"ends_at" AS "endsAt",
				"status",
				EXISTS (
					SELECT 1
					FROM "trip_porters" assignment
					WHERE assignment."trip_id" = trip."id"
						AND assignment."status" IN ('assigned', 'pending_reconfirmation')
				) AS "hasActivePorter"
			 FROM "trips" trip
			 WHERE trip."id" = $1`,
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
		return this.attachSubmittedWeatherForecasts(rows.map(toTripResponse));
	}

	async findAdminReviews(
		reviewOutcome: TripReviewOutcome,
		page: number,
		limit: number
	): Promise<{ items: AdminTripReviewResponseDto[]; total: number }> {
		const offset = (page - 1) * limit;
		const outcomePredicate = `(
			($1 = 'all' AND ${TRIP_REVIEW_OUTCOME_EXPRESSION} IS NOT NULL)
			OR ${TRIP_REVIEW_OUTCOME_EXPRESSION} = $1
		)`;
		const rows = (await this.query(
			`${ADMIN_TRIP_SELECT}
			WHERE ${outcomePredicate}
			ORDER BY COALESCE(latest_review."created_at", trip."updated_at") DESC, trip."id" ASC
			LIMIT $2 OFFSET $3`,
			[reviewOutcome, limit, offset]
		)) as TripRow[];
		const countRows = (await this.query(
			`SELECT COUNT(*) AS "total"
			FROM "trips" trip
			${LATEST_TRIP_REVIEW_JOIN}
			WHERE ${outcomePredicate}`,
			[reviewOutcome]
		)) as Array<{ total: string }>;

		return {
			items: await this.attachSubmittedWeatherForecasts(rows.map(toAdminTripReviewResponse)),
			total: Number(countRows[0]?.total ?? 0),
		};
	}

	/** Adds the weather forecast attached at submission (Admin review screens). */
	private async attachSubmittedWeatherForecasts<T extends { id: string }>(
		trips: T[]
	): Promise<Array<T & { submittedWeatherForecast: SubmittedWeatherForecastSummaryDto | null }>> {
		if (trips.length === 0) return [];
		const forecasts = (await this.query(
			`SELECT trip."id" AS "tripId", forecast."id", forecast."status",
				forecast."risk_level" AS "riskLevel",
				(trip."weather_risk_acknowledged_at" IS NOT NULL) AS "riskAcknowledged"
			 FROM "trips" trip
			 JOIN "trip_weather_forecasts" forecast
				ON forecast."id" = trip."submitted_weather_forecast_id"
			 WHERE trip."id" = ANY($1::uuid[])`,
			[trips.map((trip) => trip.id)]
		)) as Array<SubmittedWeatherForecastSummaryDto & { tripId: string }>;
		const byTrip = new Map(forecasts.map(({ tripId, ...summary }) => [tripId, summary]));
		return trips.map((trip) => ({
			...trip,
			submittedWeatherForecast: byTrip.get(trip.id) ?? null,
		}));
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

	async findUpcomingPorterCandidateTrips(hostId: string): Promise<TripResponseDto[]> {
		const rows = (await this.query(
			`${TRIP_SELECT}
			WHERE trip."host_id" = $1
				AND trip."status" = $2
				AND trip."starts_at" > clock_timestamp()
			ORDER BY trip."starts_at" ASC, trip."id" ASC`,
			[hostId, TripStatus.PUBLISHED]
		)) as TripRow[];

		return rows.map(toTripResponse);
	}

	async findPorterAssignmentHistoryByHost(hostId: string): Promise<HostPorterAssignmentTripDto[]> {
		const rows = (await this.query(
			`SELECT
				trip."id" AS "tripId",
				trip."title",
				trip."status" AS "tripStatus",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				assignment."porter_id" AS "porterId",
				porter."full_name" AS "displayName",
				porter."email",
				assignment."status" AS "assignmentStatus",
				accepted_request."responded_at" AS "assignedAt",
				assignment."reconfirmation_deadline" AS "reconfirmationDeadline",
				assignment."reconfirmed_at" AS "reconfirmedAt",
				assignment."declined_at" AS "declinedAt"
			 FROM "trips" trip
			 INNER JOIN "trip_porters" assignment ON assignment."trip_id" = trip."id"
			 INNER JOIN "users" porter ON porter."id" = assignment."porter_id"
			 LEFT JOIN LATERAL (
				SELECT request."responded_at"
				FROM "porter_requests" request
				WHERE request."trip_id" = trip."id"
					AND request."porter_id" = assignment."porter_id"
					AND request."status" = 'accepted'
				ORDER BY request."responded_at" DESC NULLS LAST, request."updated_at" DESC
				LIMIT 1
			 ) accepted_request ON TRUE
			 WHERE trip."host_id" = $1
			 ORDER BY trip."starts_at" DESC, trip."id" ASC, porter."full_name" ASC NULLS LAST`,
			[hostId]
		)) as HostPorterAssignmentRow[];

		const trips = new Map<string, HostPorterAssignmentTripDto>();
		for (const row of rows) {
			let trip = trips.get(row.tripId);
			if (!trip) {
				trip = {
					id: row.tripId,
					title: row.title,
					status: row.tripStatus,
					startsAt: row.startsAt,
					endsAt: row.endsAt,
					assignedPorterCount: 0,
					assignments: [],
				};
				trips.set(row.tripId, trip);
			}

			if (row.assignmentStatus !== "unassigned") trip.assignedPorterCount += 1;
			trip.assignments.push({
				porterId: row.porterId,
				displayName: row.displayName,
				email: row.email,
				status: row.assignmentStatus,
				assignedAt: row.assignedAt,
				reconfirmationDeadline: row.reconfirmationDeadline,
				reconfirmedAt: row.reconfirmedAt,
				declinedAt: row.declinedAt,
			});
		}

		return [...trips.values()];
	}

	findAssignedTripsByPorter(porterId: string): Promise<PorterAssignedTripResponseDto[]> {
		return this.query(
			`SELECT
				trip."id" AS "tripId",
				trip."title",
				trip."status",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				route."name" AS "routeName"
			 FROM "trip_porters" assignment
			 INNER JOIN "trips" trip ON trip."id" = assignment."trip_id"
			 LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE assignment."porter_id" = $1
			   AND assignment."status" = 'assigned'
			   AND trip."status" IN (${PORTER_VISIBLE_TRIP_STATUSES_SQL})
			 ORDER BY trip."starts_at" ASC, trip."id" ASC`,
			[porterId]
		);
	}

	async findPorterTripOperations(
		porterId: string,
		tripId: string
	): Promise<PorterTripOperationsRow | null> {
		const rows = (await this.query(PORTER_TRIP_OPERATIONS_QUERY, [
			porterId,
			tripId,
		])) as PorterTripOperationsRow[];
		return rows[0] ?? null;
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
				`ctms-027:reschedule:${tripId}:equipment:${reservation.bookingItemId}`
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
		reason: string,
		options?: CancelTripWithCommitmentsOptions
	): Promise<TripCancellationCommitmentSummary> {
		const refundIdempotencyPrefix = options?.refundIdempotencyPrefix ?? "ctms-027";
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

		// NOTE: TypeORM's PostgresQueryRunner returns `[rows, affectedRowCount]` for
		// UPDATE/DELETE (not just `rows`, unlike SELECT/INSERT) -- destructure the
		// first element for every UPDATE...RETURNING below, or `.length` silently
		// counts one bogus extra "row" (the affected-row-count number) and any
		// property access on it is `undefined`.
		const [bookingRows] = (await this.query(
			`
			UPDATE "bookings"
			SET
				"status" = 'cancelled',
				"declined_at" = $2
			WHERE "trip_id" = $1
				AND "status" IN ('confirmed', 'pending_payment', 'pending_reconfirmation')
			RETURNING "id", "user_id" AS "userId", "total_amount"::text AS "totalAmount"
			`,
			[tripId, cancelledAt]
		)) as [CancelledBookingCommitment[], number];

		const [porterRows] = (await this.query(
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
		)) as [Array<{ porterId: string }>, number];

		const [equipmentRows] = (await this.query(
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
		)) as [Array<{ id: string }>, number];

		let bookingRefundsCreated = 0;
		for (const booking of bookingRows) {
			if (booking.totalAmount) {
				bookingRefundsCreated += await this.createIdempotentRefund(
					booking.id,
					booking.totalAmount,
					`${refundIdempotencyPrefix}:trip-cancel:${tripId}:booking:${booking.id}`
				);
			}
		}

		await this.recomputeSeatsTaken(tripId);

		return {
			bookingsCancelled: bookingRows.length,
			portersUnassigned: porterRows.length,
			equipmentReservationsCancelled: equipmentRows.length,
			bookingRefundsCreated,
			cancelledBookings: bookingRows,
		};
	}

	/**
	 * Moves Trips along their time-based lifecycle in one atomic statement per phase:
	 * `published` -> `ongoing` once `starts_at` is reached, and `published`/`ongoing` ->
	 * `completed` once `ends_at` is reached. Each transition writes a system audit log.
	 * When `awaitParticipationEvaluation` is true, `published` Trips the auto-cancel worker
	 * has not evaluated yet are left alone so an under-subscribed Trip is cancelled, not started.
	 */
	async advanceTripStatusesByTime(
		target: TripStatus.ONGOING | TripStatus.COMPLETED,
		limit: number,
		awaitParticipationEvaluation: boolean
	): Promise<Array<{ id: string; previousStatus: TripStatus }>> {
		const dueCondition =
			target === TripStatus.COMPLETED
				? `"status" IN ('published', 'ongoing') AND "ends_at" <= CURRENT_TIMESTAMP`
				: `"status" = 'published' AND "starts_at" <= CURRENT_TIMESTAMP AND "ends_at" > CURRENT_TIMESTAMP`;
		return (await this.query(
			`WITH due AS (
				SELECT "id", "status"
				FROM "trips"
				WHERE ${dueCondition}
				  AND ("status" <> 'published' OR NOT $3::boolean OR "participation_evaluated_at" IS NOT NULL)
				ORDER BY "starts_at" ASC, "id" ASC
				LIMIT $2
				FOR UPDATE SKIP LOCKED
			 ), moved AS (
				UPDATE "trips" trip
				SET "status" = $1, "updated_at" = CURRENT_TIMESTAMP
				FROM due
				WHERE trip."id" = due."id"
				RETURNING trip."id", due."status" AS "previousStatus"
			 ), logged AS (
				INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason")
				SELECT NULL, 'trip.status_advanced', 'trip', moved."id",
					jsonb_build_object('status', moved."previousStatus"),
					jsonb_build_object('status', $1::text),
					'schedule_reached'
				FROM moved
			 )
			 SELECT "id", "previousStatus" FROM moved`,
			[target, limit, awaitParticipationEvaluation]
		)) as Array<{ id: string; previousStatus: TripStatus }>;
	}

	/**
	 * CTMS-036. Batch candidate query for the auto-cancel worker: published
	 * Trips past their booking deadline that this flow has not yet evaluated.
	 * `participation_evaluated_at IS NULL` keeps a Trip that already turned
	 * out to have enough participants from being re-fetched on every future
	 * tick forever (nothing else moves a sufficiently-funded Trip out of
	 * `published`, since `TripStatus.ONGOING` is not wired to any transition
	 * yet elsewhere in this codebase).
	 */
	async findAutoCancelCandidateIds(limit: number): Promise<string[]> {
		const rows = (await this.query(
			`SELECT "id"
			 FROM "trips"
			 WHERE "status" = $1
			   AND "booking_deadline" < CURRENT_TIMESTAMP
			   AND "participation_evaluated_at" IS NULL
			 ORDER BY "booking_deadline" ASC, "id" ASC
			 LIMIT $2`,
			[TripStatus.PUBLISHED, limit]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/** CTMS-036. Minimal FOR UPDATE projection for the per-Trip auto-cancel transaction. */
	async findForAutoCancelEvaluation(
		tripId: string
	): Promise<LockedTripForAutoCancelEvaluation | null> {
		const rows = (await this.query(
			`SELECT
				"id",
				"status",
				"booking_deadline" AS "bookingDeadline",
				"capacity_min" AS "capacityMin",
				"participation_evaluated_at" AS "participationEvaluatedAt"
			 FROM "trips"
			 WHERE "id" = $1
			 FOR UPDATE`,
			[tripId]
		)) as Array<{
			id: string;
			status: TripStatus;
			bookingDeadline: Date;
			capacityMin: number;
			participationEvaluatedAt: Date | null;
		}>;
		return rows[0] ?? null;
	}

	/** CTMS-036. Confirmed participation excludes `pending_payment` (a mere seat hold, BR-107)
	 *  and `pending_reconfirmation` (not yet reconfirmed after a Host reschedule, CTMS-160) --
	 *  neither represents authoritative confirmed participation. */
	async countConfirmedParticipants(tripId: string): Promise<number> {
		const rows = (await this.query(
			`SELECT COALESCE(SUM("num_people"), 0)::int AS "count"
			 FROM "bookings"
			 WHERE "trip_id" = $1 AND "status" = 'confirmed'`,
			[tripId]
		)) as Array<{ count: number }>;
		return rows[0]?.count ?? 0;
	}

	/** CTMS-036. Marks a Trip as evaluated (sufficient participants, no cancellation needed)
	 *  so the auto-cancel worker's candidate query excludes it from now on. */
	async markParticipationEvaluated(tripId: string, evaluatedAt: Date): Promise<void> {
		await this.query(
			`UPDATE "trips" SET "participation_evaluated_at" = $2, "updated_at" = now() WHERE "id" = $1`,
			[tripId, evaluatedAt]
		);
	}

	private async createIdempotentRefund(
		bookingId: string,
		amount: string,
		idempotencyKey: string
	): Promise<number> {
		// `provider_reference` holds a REAL payment-provider transaction reference
		// (e.g. the bank transfer code an Admin enters when confirming a manual
		// refund, see RefundsService.confirmManualTransfer) -- it must stay NULL
		// here since creating this `pending` obligation does not itself involve
		// any provider transaction yet. Pre-existing bug fixed while on CTMS-179:
		// this previously stored the cancellation reason string in this column
		// (confirmed via `git log -S` to predate this story, introduced by
		// CTMS-027's 22c2d06), which rendered as a fake "Mã giao dịch đối soát"
		// in the Camper-facing refund history UI.
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
					"parent_payment_id"
				)
				SELECT
					$1,
					$2::numeric,
					'refund',
					'pending',
					$3::text,
					substr(md5($3::text || ':' || $2::text) || md5($2::text || ':' || $3::text), 1, 64),
					parent_charge."id"
				FROM parent_charge
				WHERE $2::numeric > 0
				ON CONFLICT ("booking_id", "idempotency_key")
					WHERE "idempotency_key" IS NOT NULL
				DO NOTHING
				RETURNING "id"
			)
			SELECT COUNT(*)::int AS "createdCount" FROM inserted
			`,
			[bookingId, amount, idempotencyKey]
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
