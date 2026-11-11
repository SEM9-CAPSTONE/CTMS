import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
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
