import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
	type TripWeatherWorstReading,
} from "../entities/trip-weather-forecast.entity";

export interface TripForWeatherForecast {
	id: string;
	hostId: string;
	status: string;
	routeId: string | null;
	startsAt: Date | null;
	endsAt: Date | null;
	submittedWeatherForecastId: string | null;
	/** [longitude, latitude] of the Route centroid; null when the Trip has no Route. */
	centroid: [number, number] | null;
}

export interface TripWeatherAiMismatchRow {
	forecastId: string;
	tripId: string;
	tripTitle: string;
	tripStatus: string;
	tripStartsAt: Date;
	hostId: string;
	hostName: string | null;
	riskLevel: string;
	aiRiskLevel: string;
	aiReason: string;
	aiConfidence: number;
	aiReviewedAt: Date;
	worstReading: TripWeatherWorstReading | null;
	ruleVersion: number | null;
}

const LEVEL_RANK_SQL = (column: string) =>
	`CASE ${column} WHEN 'green' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END`;

/** UPDATE ... RETURNING through `query` yields `[rows, count]`; plain SELECTs yield rows. */
function affectedRows(result: unknown[]): number {
	if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === "number") {
		return result[1];
	}
	return result.length;
}

@Injectable()
export class TripWeatherForecastsRepository extends Repository<TripWeatherForecast> {
	async findTripForForecast(tripId: string): Promise<TripForWeatherForecast | null> {
		const rows = (await this.query(
			`SELECT
				trip."id",
				trip."host_id" AS "hostId",
				trip."status",
				trip."route_id" AS "routeId",
				trip."starts_at" AS "startsAt",
				trip."ends_at" AS "endsAt",
				trip."submitted_weather_forecast_id" AS "submittedWeatherForecastId",
				ST_AsGeoJSON(ST_Centroid(route."route_geom"::geometry))::json->'coordinates' AS "centroid"
			 FROM "trips" trip
			 LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE trip."id" = $1`,
			[tripId]
		)) as TripForWeatherForecast[];
		return rows[0] ?? null;
	}

	findLatestForTrip(tripId: string): Promise<TripWeatherForecast | null> {
		return this.findOne({ where: { tripId }, order: { createdAt: "DESC", id: "DESC" } });
	}

	/** Newest result that carried a risk level; the reference for "did the level change?". */
	findLatestAvailableForTrip(tripId: string): Promise<TripWeatherForecast | null> {
		return this.findOne({
			where: { tripId, status: TripWeatherForecastStatus.AVAILABLE },
			order: { createdAt: "DESC", id: "DESC" },
		});
	}

	/** Records that an unchanged result was confirmed again, without adding a history row. */
	async touchCheckedAt(
		forecast: TripWeatherForecast,
		checkedAt: Date
	): Promise<TripWeatherForecast> {
		await this.query(`UPDATE "trip_weather_forecasts" SET "checked_at" = $2 WHERE "id" = $1`, [
			forecast.id,
			checkedAt,
		]);
		forecast.checkedAt = checkedAt;
		return forecast;
	}

	/** Every stored change of the Trip's forecast, newest first. */
	findHistory(tripId: string, limit: number): Promise<TripWeatherForecast[]> {
		return this.find({ where: { tripId }, order: { createdAt: "DESC", id: "DESC" }, take: limit });
	}

	/**
	 * Published/ongoing Trips starting within the forecast horizon whose newest forecast was last
	 * confirmed longer ago than their cadence: 6 h when departure is at most 3 days away (or the Trip
	 * is running), 24 h otherwise. Trips never forecast come first.
	 */
	async findDueTripIds(
		now: Date,
		options: {
			horizonMs: number;
			nearWindowMs: number;
			nearIntervalMs: number;
			farIntervalMs: number;
			limit: number;
		}
	): Promise<string[]> {
		const rows = (await this.query(
			`SELECT trip."id"
			 FROM "trips" trip
			 LEFT JOIN LATERAL (
			   SELECT f."checked_at" FROM "trip_weather_forecasts" f
			   WHERE f."trip_id" = trip."id"
			   ORDER BY f."created_at" DESC, f."id" DESC LIMIT 1
			 ) latest ON true
			 WHERE trip."status" IN ('published', 'ongoing')
			   AND trip."route_id" IS NOT NULL
			   AND trip."ends_at" > $1::timestamptz
			   AND trip."starts_at" <= $1::timestamptz + ($2::bigint * interval '1 millisecond')
			   AND (
			     latest."checked_at" IS NULL
			     OR latest."checked_at" <= $1::timestamptz - (
			       CASE WHEN trip."starts_at" - $1::timestamptz <= ($3::bigint * interval '1 millisecond')
			         THEN $4::bigint ELSE $5::bigint END * interval '1 millisecond'
			     )
			   )
			 ORDER BY latest."checked_at" ASC NULLS FIRST, trip."starts_at" ASC
			 LIMIT $6::int`,
			[
				now,
				options.horizonMs,
				options.nearWindowMs,
				options.nearIntervalMs,
				options.farIntervalMs,
				options.limit,
			]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	/**
	 * Retention: for Trips that ended before `endedBefore`, drop the forecast history except the
	 * forecast attached at submission for approval. Returns the number of rows removed.
	 */
	async deleteEndedTripHistory(endedBefore: Date): Promise<number> {
		const rows = (await this.query(
			`DELETE FROM "trip_weather_forecasts" f
			 USING "trips" trip
			 WHERE f."trip_id" = trip."id"
			   AND trip."ends_at" < $1
			   AND f."id" IS DISTINCT FROM trip."submitted_weather_forecast_id"
			   AND NOT EXISTS (
			     SELECT 1 FROM "trip_weather_decisions" decision WHERE decision."forecast_id" = f."id"
			   )
			   AND NOT EXISTS (
			     SELECT 1 FROM "trip_weather_decision_alerts" alert WHERE alert."forecast_id" = f."id"
			   )
			 RETURNING f."id"`,
			[endedBefore]
		)) as unknown[];
		return Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : rows.length;
	}

	findByIdForTrip(tripId: string, id: string): Promise<TripWeatherForecast | null> {
		return this.findOneBy({ id, tripId });
	}

	/**
	 * Hybrid review queue: the newest forecast of each pending, published or running Trip that still
	 * has a risk level but no AI opinion, oldest first. Only the newest row matters because older
	 * rows no longer describe the Trip.
	 */
	async findPendingAiReviews(
		now: Date,
		limit: number,
		maxAttempts: number
	): Promise<TripWeatherForecast[]> {
		const rows = (await this.query(
			`SELECT latest."id"
			 FROM "trips" trip
			 JOIN LATERAL (
			   SELECT f."id", f."status", f."ai_reviewed_at", f."ai_review_attempts", f."created_at"
			   FROM "trip_weather_forecasts" f
			   WHERE f."trip_id" = trip."id"
			   ORDER BY f."created_at" DESC, f."id" DESC LIMIT 1
			 ) latest ON true
			 WHERE trip."status" IN ('pending_approval', 'published', 'ongoing')
			   AND trip."ends_at" > $1
			   AND latest."status" = 'available'
			   AND latest."ai_reviewed_at" IS NULL
			   AND latest."ai_review_attempts" < $3
			 ORDER BY latest."created_at" ASC
			 LIMIT $2`,
			[now, limit, maxAttempts]
		)) as Array<{ id: string }>;
		if (rows.length === 0) return [];
		const forecasts = await this.find({ where: rows.map((row) => ({ id: row.id })) });
		const order = new Map(rows.map((row, index) => [row.id, index]));
		return forecasts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
	}

	/** Stores the AI opinion once; a concurrent writer that got there first wins. */
	async saveAiReview(
		id: string,
		review: { level: string; reason: string; confidence: number; model: string },
		reviewedAt: Date
	): Promise<boolean> {
		const result = (await this.query(
			`UPDATE "trip_weather_forecasts"
			 SET "ai_risk_level" = $2::"weather_risk_level", "ai_reason" = $3, "ai_confidence" = $4,
			     "ai_model" = $5, "ai_reviewed_at" = $6, "ai_review_attempts" = "ai_review_attempts" + 1
			 WHERE "id" = $1 AND "ai_reviewed_at" IS NULL AND "risk_level" IS NOT NULL
			 RETURNING "id"`,
			[id, review.level, review.reason, review.confidence, review.model, reviewedAt]
		)) as unknown[];
		return affectedRows(result) > 0;
	}

	/** Counts a failed attempt; `exhausted` stops further attempts on this forecast. */
	async recordAiReviewFailure(id: string, maxAttempts: number, exhausted: boolean): Promise<void> {
		await this.query(
			`UPDATE "trip_weather_forecasts"
			 SET "ai_review_attempts" = CASE WHEN $3 THEN $2 ELSE LEAST("ai_review_attempts" + 1, $2) END
			 WHERE "id" = $1 AND "ai_reviewed_at" IS NULL`,
			[id, maxAttempts, exhausted]
		);
	}

	/**
	 * Upcoming or running Trips whose newest forecast disagrees with the AI opinion and that no Admin
	 * has marked as seen. Wider disagreement (Green vs Red) first, then the soonest departure.
	 */
	findAiMismatches(now: Date, limit: number): Promise<TripWeatherAiMismatchRow[]> {
		return this.query(
			`SELECT
			   latest."id" AS "forecastId",
			   trip."id" AS "tripId",
			   trip."title" AS "tripTitle",
			   trip."status" AS "tripStatus",
			   trip."starts_at" AS "tripStartsAt",
			   trip."host_id" AS "hostId",
			   host."full_name" AS "hostName",
			   latest."risk_level" AS "riskLevel",
			   latest."ai_risk_level" AS "aiRiskLevel",
			   latest."ai_reason" AS "aiReason",
			   latest."ai_confidence" AS "aiConfidence",
			   latest."ai_reviewed_at" AS "aiReviewedAt",
			   latest."worst_reading" AS "worstReading",
			   rule."version" AS "ruleVersion"
			 FROM "trips" trip
			 JOIN LATERAL (
			   SELECT f.* FROM "trip_weather_forecasts" f
			   WHERE f."trip_id" = trip."id"
			   ORDER BY f."created_at" DESC, f."id" DESC LIMIT 1
			 ) latest ON true
			 LEFT JOIN "users" host ON host."id" = trip."host_id"
			 LEFT JOIN "weather_risk_rules" rule ON rule."id" = latest."rule_version_id"
			 WHERE trip."status" IN ('pending_approval', 'published', 'ongoing')
			   AND trip."ends_at" > $1
			   AND latest."ai_risk_level" IS NOT NULL
			   AND latest."ai_risk_level" <> latest."risk_level"
			   AND latest."ai_review_acknowledged_at" IS NULL
			 ORDER BY abs(${LEVEL_RANK_SQL('latest."ai_risk_level"')} - ${LEVEL_RANK_SQL('latest."risk_level"')}) DESC,
			   trip."starts_at" ASC
			 LIMIT $2`,
			[now, limit]
		) as Promise<TripWeatherAiMismatchRow[]>;
	}

	/** Marks a disagreement as seen; returns false when there is nothing (left) to mark. */
	async acknowledgeAiReview(id: string, adminId: string, at: Date): Promise<boolean> {
		const result = (await this.query(
			`UPDATE "trip_weather_forecasts"
			 SET "ai_review_acknowledged_at" = $3, "ai_review_acknowledged_by" = $2
			 WHERE "id" = $1 AND "ai_reviewed_at" IS NOT NULL AND "ai_review_acknowledged_at" IS NULL
			 RETURNING "id"`,
			[id, adminId, at]
		)) as unknown[];
		return affectedRows(result) > 0;
	}

	async saveAdvice(
		id: string,
		adviceText: string,
		actions: string[]
	): Promise<TripWeatherForecast | null> {
		// First writer wins, so concurrent advice requests cannot overwrite each other.
		await this.query(
			`UPDATE "trip_weather_forecasts"
			 SET "advice_text" = $2, "advice_actions" = $3::jsonb, "advice_generated_at" = now()
			 WHERE "id" = $1 AND "advice_text" IS NULL`,
			[id, adviceText, JSON.stringify(actions)]
		);
		return this.findOneBy({ id });
	}
}
