import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { type WeatherSnapshot, WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";

export interface RouteForWeatherFetch {
	id: string;
	status: string;
	hostId: string;
	/** Centroid of the route's LineString, in [longitude, latitude] order to
	 * match GeoJSON convention -- the one representative point "the route
	 * area" is fetched for (CTMS-93's own checklist: "normalized for the
	 * route area", not per-checkpoint). */
	centroid: [number, number];
}

export interface CreateSuccessSnapshotInput {
	routeId: string;
	observedAt: Date;
	rainfallMm: number;
	windKph: number;
	temperatureC: number;
	visibilityM: number;
	thunderstorm: boolean;
	providerWeatherCode: number;
	providerResponse: Record<string, unknown>;
}

export interface CreateFailedSnapshotInput {
	routeId: string;
	errorMessage: string;
}

const SNAPSHOT_SELECT_COLUMNS = `
	"id",
	"route_id" AS "routeId",
	"status",
	"observed_at" AS "observedAt",
	"rainfall_mm" AS "rainfallMm",
	"wind_kph" AS "windKph",
	"temperature_c" AS "temperatureC",
	"visibility_m" AS "visibilityM",
	"thunderstorm",
	"provider_weather_code" AS "providerWeatherCode",
	"provider_response" AS "providerResponse",
	"error_message" AS "errorMessage",
	"created_at" AS "createdAt"
`;

@Injectable()
export class WeatherSnapshotsRepository extends Repository<WeatherSnapshot> {
	/**
	 * Plain read, not locked -- the provider call this feeds into is slow
	 * network I/O (up to `WEATHER_API_TIMEOUT_MS` per attempt, times up to
	 * 3 retries), and holding a Postgres row lock open across that would
	 * block unrelated route operations (e.g. a Host editing checkpoints)
	 * for no real benefit: two concurrent refreshes for the same route each
	 * produce their own legitimate, independently-timestamped snapshot row,
	 * not a duplicate to reject. BR-230's "no duplicate records" is
	 * satisfied instead by the retry loop staying entirely in-memory
	 * (WeatherService) before the single resulting row is ever written.
	 */
	async findRouteForFetch(routeId: string): Promise<RouteForWeatherFetch | null> {
		const rows = (await this.query(
			`
			SELECT
				route."id",
				route."status",
				campsite."host_id" AS "hostId",
				ST_AsGeoJSON(ST_Centroid(route."route_geom"::geometry))::json->'coordinates' AS "centroid"
			FROM "trekking_routes" route
			INNER JOIN "campsites" campsite ON campsite."id" = route."campsite_id"
			WHERE route."id" = $1
			`,
			[routeId]
		)) as Array<{ id: string; status: string; hostId: string; centroid: [number, number] }>;

		return rows[0] ?? null;
	}

	async createSuccess(input: CreateSuccessSnapshotInput): Promise<WeatherSnapshot> {
		const rows = (await this.query(
			`
			INSERT INTO "weather_snapshots" (
				"route_id", "status", "observed_at", "rainfall_mm", "wind_kph",
				"temperature_c", "visibility_m", "thunderstorm", "provider_weather_code",
				"provider_response", "error_message"
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)
			RETURNING ${SNAPSHOT_SELECT_COLUMNS}
			`,
			[
				input.routeId,
				WeatherSnapshotStatus.SUCCESS,
				input.observedAt,
				input.rainfallMm,
				input.windKph,
				input.temperatureC,
				input.visibilityM,
				input.thunderstorm,
				input.providerWeatherCode,
				JSON.stringify(input.providerResponse),
			]
		)) as WeatherSnapshot[];

		return rows[0];
	}

	async createFailed(input: CreateFailedSnapshotInput): Promise<WeatherSnapshot> {
		const rows = (await this.query(
			`
			INSERT INTO "weather_snapshots" ("route_id", "status", "error_message")
			VALUES ($1, $2, $3)
			RETURNING ${SNAPSHOT_SELECT_COLUMNS}
			`,
			[input.routeId, WeatherSnapshotStatus.FAILED, input.errorMessage]
		)) as WeatherSnapshot[];

		return rows[0];
	}

	async findLatestForRoute(routeId: string): Promise<WeatherSnapshot | null> {
		const rows = (await this.query(
			`
			SELECT ${SNAPSHOT_SELECT_COLUMNS}
			FROM "weather_snapshots"
			WHERE "route_id" = $1
			ORDER BY "created_at" DESC
			LIMIT 1
			`,
			[routeId]
		)) as WeatherSnapshot[];

		return rows[0] ?? null;
	}
}
