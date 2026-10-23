import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { TripWeatherForecast } from "../entities/trip-weather-forecast.entity";

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
