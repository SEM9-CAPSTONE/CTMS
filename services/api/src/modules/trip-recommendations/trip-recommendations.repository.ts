import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { TripBookingFacts } from "../bookings/trip-booking-eligibility";
import type { ActivityProfile } from "../profiles/entities/activity-profile";
import { BookingStatus } from "../profiles/entities/booking.entity";
import type { FitnessLevel } from "../profiles/entities/health-profile.entity";
import type {
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import type { TripStatus, TripType } from "../trips/entities/trip.entity";
import { CamperTripPreference } from "./entities/camper-trip-preference.entity";
import { TripRecommendationRun } from "./entities/trip-recommendation-run.entity";
import {
	type CandidateFacts,
	EMPTY_PREFERENCES,
	HISTORY_BOOKING_LIMIT,
	HISTORY_MONTHS,
	type HealthSignal,
	type HistoryTripFacts,
	type TripPreferences,
} from "./trip-recommendation.policy";
import { isTripRegionCode, regionForPoint } from "./trip-regions";

/** Upper bound on Trips read per generation; ordered by nearest departure. */
export const CANDIDATE_SCAN_LIMIT = 500;

export interface CandidateRow extends CandidateFacts, TripBookingFacts {
	routeId: string;
	endsAt: Date;
}

/** Bookings that already hold a seat for this Camper; such Trips are not suggested again. */
const ACTIVE_BOOKING_STATUSES = [
	BookingStatus.PENDING_PAYMENT,
	BookingStatus.CONFIRMED,
	BookingStatus.PENDING_RECONFIRMATION,
];

interface RawCandidateRow {
	id: string;
	routeId: string;
	status: TripStatus;
	tripType: TripType;
	durationNights: number | string;
	difficulty: TrekkingRouteDifficulty | null;
	routeStatus: TrekkingRouteStatus | null;
	bookingDeadline: Date;
	startsAt: Date;
	endsAt: Date;
	capacityMax: number | string | null;
	seatsTaken: number | string;
	pricePerPerson: number | string;
	weatherPausedAt: Date | null;
	latitude: number | null;
	longitude: number | null;
	publishedAt: Date;
	lengthMeters: number | string | null;
	durationMinutes: number | string | null;
}

/** One Trip as the "why this suggestion" explanation needs it, whatever its booking state. */
export interface ExplanationTripRow extends CandidateRow {
	title: string;
	description: string | null;
	/** The Camper already holds a seat on this Trip. */
	heldByCamper: boolean;
}

/** The Camper's own profile entries quoted back in an explanation. */
export interface ExplanationProfile {
	bio: string | null;
	/** YYYY-MM-DD */
	dateOfBirth: string | null;
	/** "Số năm kinh nghiệm" on the profile. */
	experienceYears: number | null;
	/** "Kinh nghiệm trekking" on the profile. */
	experienceDetails: string | null;
	/** Present only with health-sharing consent. */
	health: {
		fitnessLevel: FitnessLevel;
		activityProfile?: ActivityProfile | null;
		allergies: Array<{ name: string; severity: string | null }>;
		medicalConditions: Array<{ name: string; medication: string | null }>;
		dietaryRestrictions: string | null;
	} | null;
}

const nullableNumber = (value: number | string | null): number | null =>
	value === null ? null : Number(value);

@Injectable()
export class TripRecommendationsRepository {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Published Trips that still take bookings by date, with every fact the booking rules need.
	 * The SQL only narrows the scan; the shared booking policy remains the authority. Trips without
	 * a Route (inner join) cannot be confirmed eligible and are never returned.
	 */
	async findCandidateRows(userId: string, onlyTripIds?: string[]): Promise<CandidateRow[]> {
		const params: unknown[] = [userId, ACTIVE_BOOKING_STATUSES];
		let idFilter = "";
		if (onlyTripIds) {
			if (onlyTripIds.length === 0) return [];
			params.push(onlyTripIds);
			idFilter = `AND trip."id" = ANY($${params.length}::uuid[])`;
		}
		params.push(CANDIDATE_SCAN_LIMIT);
		const rows = (await this.dataSource.query(
			`
			SELECT
				trip."id",
				trip."route_id" AS "routeId",
				trip."status",
				trip."trip_type" AS "tripType",
				trip."duration_nights" AS "durationNights",
				route."difficulty",
				route."status" AS "routeStatus",
				trip."booking_deadline" AS "bookingDeadline",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				trip."capacity_max" AS "capacityMax",
				trip."seats_taken" AS "seatsTaken",
				trip."price_per_person" AS "pricePerPerson",
				trip."weather_paused_at" AS "weatherPausedAt",
				ST_Y(trip."meeting_point"::geometry) AS "latitude",
				ST_X(trip."meeting_point"::geometry) AS "longitude",
				COALESCE(approval."created_at", trip."created_at") AS "publishedAt",
				route."length_meters" AS "lengthMeters",
				route."expected_duration_minutes" AS "durationMinutes"
			FROM "trips" trip
			INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			LEFT JOIN LATERAL (
				SELECT audit."created_at"
				FROM "audit_logs" audit
				WHERE audit."target_id" = trip."id"
					AND audit."target_type" = 'trip'
					AND audit."action" = 'trip.approved'
				ORDER BY audit."created_at" DESC
				LIMIT 1
			) approval ON true
			WHERE trip."status" = 'published'
				AND trip."booking_deadline" > now()
				AND trip."starts_at" > now()
				AND NOT EXISTS (
					SELECT 1 FROM "bookings" booking
					WHERE booking."trip_id" = trip."id"
						AND booking."user_id" = $1
						AND booking."status"::text = ANY($2::text[])
				)
				${idFilter}
			ORDER BY trip."starts_at" ASC, trip."id" ASC
			LIMIT $${params.length}
			`,
			params
		)) as RawCandidateRow[];
		return rows.map(toCandidateRow);
	}

	/**
	 * A single Trip for the explanation, without the bookable-date and held-seat filters so the
	 * explanation can say why it is no longer open. Unpublished Trips are never returned.
	 */
	async findExplanationTrip(userId: string, tripId: string): Promise<ExplanationTripRow | null> {
		const [row] = (await this.dataSource.query(
			`
			SELECT
				trip."id",
				trip."title",
				trip."description",
				trip."route_id" AS "routeId",
				trip."status",
				trip."trip_type" AS "tripType",
				trip."duration_nights" AS "durationNights",
				route."difficulty",
				route."status" AS "routeStatus",
				trip."booking_deadline" AS "bookingDeadline",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				trip."capacity_max" AS "capacityMax",
				trip."seats_taken" AS "seatsTaken",
				trip."price_per_person" AS "pricePerPerson",
				trip."weather_paused_at" AS "weatherPausedAt",
				ST_Y(trip."meeting_point"::geometry) AS "latitude",
				ST_X(trip."meeting_point"::geometry) AS "longitude",
				trip."created_at" AS "publishedAt",
				route."length_meters" AS "lengthMeters",
				route."expected_duration_minutes" AS "durationMinutes",
				EXISTS (
					SELECT 1 FROM "bookings" booking
					WHERE booking."trip_id" = trip."id"
						AND booking."user_id" = $1
						AND booking."status"::text = ANY($3::text[])
				) AS "heldByCamper"
			FROM "trips" trip
			INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			WHERE trip."id" = $2 AND trip."status" = 'published'
			`,
			[userId, tripId, ACTIVE_BOOKING_STATUSES]
		)) as Array<
			RawCandidateRow & { title: string; description: string | null; heldByCamper: boolean }
		>;
		if (!row) return null;
		return {
			...toCandidateRow(row),
			title: row.title,
			description: row.description,
			heldByCamper: row.heldByCamper,
		};
	}

	/**
	 * Read current consented activity facts and support-needs flags for the requesting Camper.
	 * Clinical names, medication and emergency notes are not selected for ranking or sent to AI.
	 */
	async findHealthSignal(userId: string): Promise<HealthSignal | null> {
		const [row] = (await this.dataSource.query(
			`
			SELECT
				"physical_fitness_level" AS "fitnessLevel",
				"activity_profile" AS "activityProfile",
				jsonb_array_length(COALESCE("medical_conditions", '[]'::jsonb)) > 0 AS "hasMedicalConditions"
			FROM "health_profiles"
			WHERE "user_id" = $1 AND "is_consent_granted" = true
			`,
			[userId]
		)) as HealthSignal[];
		return row ?? null;
	}

	/**
	 * What the Camper wrote in their own profile, read only to explain a suggestion back to them.
	 * Health details come only with consent. Never used for ranking and never sent to the AI.
	 */
	async findExplanationProfile(userId: string): Promise<ExplanationProfile> {
		const [row] = (await this.dataSource.query(
			`
			SELECT
				account."bio",
				account."date_of_birth"::text AS "dateOfBirth",
				account."camping_experience_years" AS "experienceYears",
				account."trekking_experience_details" AS "experienceDetails",
				health."physical_fitness_level" AS "fitnessLevel",
				health."activity_profile" AS "activityProfile",
				health."allergies",
				health."medical_conditions" AS "medicalConditions",
				health."dietary_restrictions" AS "dietaryRestrictions"
			FROM "users" account
			LEFT JOIN "health_profiles" health
				ON health."user_id" = account."id" AND health."is_consent_granted" = true
			WHERE account."id" = $1
			`,
			[userId]
		)) as Array<{
			bio: string | null;
			dateOfBirth: string | null;
			experienceYears: number | string | null;
			experienceDetails: string | null;
			fitnessLevel: FitnessLevel | null;
			activityProfile: ActivityProfile | null;
			allergies: Array<{ name?: unknown; severity?: unknown }> | null;
			medicalConditions: Array<{ name?: unknown; medication?: unknown }> | null;
			dietaryRestrictions: string | null;
		}>;
		const text = (value: unknown) =>
			typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
		return {
			bio: text(row?.bio),
			dateOfBirth: text(row?.dateOfBirth),
			experienceYears:
				row?.experienceYears === null || row?.experienceYears === undefined
					? null
					: Number(row.experienceYears),
			experienceDetails: text(row?.experienceDetails),
			health: row?.fitnessLevel
				? {
						fitnessLevel: row.fitnessLevel,
						activityProfile: row.activityProfile,
						allergies: (row.allergies ?? []).flatMap((item) => {
							const name = text(item?.name);
							return name ? [{ name, severity: text(item?.severity) }] : [];
						}),
						medicalConditions: (row.medicalConditions ?? []).flatMap((item) => {
							const name = text(item?.name);
							return name ? [{ name, medication: text(item?.medication) }] : [];
						}),
						dietaryRestrictions: text(row.dietaryRestrictions),
					}
				: null,
		};
	}

	/** The Camper's most recent generation, i.e. what they were last shown. */
	async findLatestRun(
		userId: string
	): Promise<Pick<TripRecommendationRun, "results" | "generatedAt"> | null> {
		const [row] = (await this.dataSource.query(
			`
			SELECT "results", "generated_at" AS "generatedAt"
			FROM "trip_recommendation_runs"
			WHERE "user_id" = $1
			ORDER BY "generated_at" DESC
			LIMIT 1
			`,
			[userId]
		)) as Array<Pick<TripRecommendationRun, "results" | "generatedAt">>;
		return row ? { results: row.results, generatedAt: new Date(row.generatedAt) } : null;
	}

	/**
	 * Trip attributes of the Camper's latest confirmed/completed bookings in the last 12 months.
	 * Only Trip attributes leave this query: no booking id, amount, payment or member data.
	 */
	async findHistoryTrips(userId: string): Promise<HistoryTripFacts[]> {
		const rows = (await this.dataSource.query(
			`
			SELECT
				trip."trip_type" AS "tripType",
				route."difficulty",
				trip."price_per_person" AS "pricePerPerson",
				ST_Y(trip."meeting_point"::geometry) AS "latitude",
				ST_X(trip."meeting_point"::geometry) AS "longitude"
			FROM "bookings" booking
			INNER JOIN "trips" trip ON trip."id" = booking."trip_id"
			LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
			WHERE booking."user_id" = $1
				AND booking."status"::text = ANY($2::text[])
				AND booking."created_at" >= now() - make_interval(months => $3)
			ORDER BY booking."created_at" DESC, booking."id" DESC
			LIMIT $4
			`,
			[
				userId,
				[BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
				HISTORY_MONTHS,
				HISTORY_BOOKING_LIMIT,
			]
		)) as Array<{
			tripType: TripType;
			difficulty: TrekkingRouteDifficulty | null;
			pricePerPerson: number | string;
			latitude: number | null;
			longitude: number | null;
		}>;
		return rows.map((row) => ({
			tripType: row.tripType,
			difficulty: row.difficulty,
			region: regionForPoint(row.latitude, row.longitude),
			pricePerPerson: Number(row.pricePerPerson),
		}));
	}

	async findPreferences(userId: string): Promise<TripPreferences & { updatedAt: Date | null }> {
		const row = await this.dataSource
			.getRepository(CamperTripPreference)
			.findOne({ where: { userId } });
		if (!row) return { ...EMPTY_PREFERENCES, updatedAt: null };
		return {
			tripTypes: row.tripTypes,
			difficulties: row.difficulties,
			// A region later removed from the catalog is ignored rather than failing the read.
			regions: row.regions.filter(isTripRegionCode),
			minPrice: row.minPrice,
			maxPrice: row.maxPrice,
			updatedAt: row.updatedAt,
		};
	}

	async replacePreferences(
		userId: string,
		preferences: TripPreferences
	): Promise<TripPreferences & { updatedAt: Date | null }> {
		await this.dataSource.query(
			`
			INSERT INTO "camper_trip_preferences"
				("user_id", "trip_types", "difficulties", "regions", "min_price", "max_price")
			VALUES ($1, $2::text[], $3::text[], $4::text[], $5, $6)
			ON CONFLICT ("user_id") DO UPDATE SET
				"trip_types" = EXCLUDED."trip_types",
				"difficulties" = EXCLUDED."difficulties",
				"regions" = EXCLUDED."regions",
				"min_price" = EXCLUDED."min_price",
				"max_price" = EXCLUDED."max_price",
				"updated_at" = now()
			`,
			[
				userId,
				preferences.tripTypes,
				preferences.difficulties,
				preferences.regions,
				preferences.minPrice,
				preferences.maxPrice,
			]
		);
		return this.findPreferences(userId);
	}

	async recordRun(run: Omit<TripRecommendationRun, "id">): Promise<void> {
		await this.dataSource.getRepository(TripRecommendationRun).insert(run);
	}

	/** Latest run of this Camper that called the AI with the same signals, made after `since`. */
	async findReusableAiRun(
		userId: string,
		fingerprint: string,
		since: Date
	): Promise<Pick<TripRecommendationRun, "id" | "aiRanking"> | null> {
		const [row] = (await this.dataSource.query(
			`
			SELECT "id", "ai_ranking" AS "aiRanking"
			FROM "trip_recommendation_runs"
			WHERE "user_id" = $1
				AND "signal_fingerprint" = $2
				AND "ai_ranking" IS NOT NULL
				AND "generated_at" >= $3
			ORDER BY "generated_at" DESC
			LIMIT 1
			`,
			[userId, fingerprint, since]
		)) as Array<Pick<TripRecommendationRun, "id" | "aiRanking">>;
		return row ?? null;
	}
}

function toCandidateRow(row: RawCandidateRow): CandidateRow {
	return {
		tripId: row.id,
		routeId: row.routeId,
		status: row.status,
		tripType: row.tripType,
		durationNights: Number(row.durationNights),
		difficulty: row.difficulty,
		routeStatus: row.routeStatus,
		region: regionForPoint(row.latitude, row.longitude),
		bookingDeadline: new Date(row.bookingDeadline),
		startsAt: new Date(row.startsAt),
		endsAt: new Date(row.endsAt),
		capacityMax: row.capacityMax === null ? null : Number(row.capacityMax),
		seatsTaken: Number(row.seatsTaken),
		pricePerPerson: Number(row.pricePerPerson),
		weatherPausedAt: row.weatherPausedAt,
		publishedAt: new Date(row.publishedAt),
		routeLengthMeters: nullableNumber(row.lengthMeters),
		routeDurationMinutes: nullableNumber(row.durationMinutes),
	};
}
