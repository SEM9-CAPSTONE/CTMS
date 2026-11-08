import { Injectable, Logger } from "@nestjs/common";
import { WEATHER_FORECAST_HORIZON_DAYS } from "../providers/weather-provider.interface";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherForecastsRepository } from "../repositories/trip-weather-forecasts.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherForecastService } from "./trip-weather-forecast.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Policy §4 cadence: daily while departure is more than 3 days away, every 6 h after that. */
export const TRIP_WEATHER_MONITOR_NEAR_WINDOW_MS = 3 * DAY_MS;
export const TRIP_WEATHER_MONITOR_NEAR_INTERVAL_MS = 6 * HOUR_MS;
export const TRIP_WEATHER_MONITOR_FAR_INTERVAL_MS = 24 * HOUR_MS;
/** Policy §4 retention: history of Trips that ended more than 30 days ago is trimmed. */
export const TRIP_WEATHER_HISTORY_RETENTION_MS = 30 * DAY_MS;

export interface TripWeatherMonitorRunResult {
	checked: number;
	failed: number;
}

/**
 * CTMS-93 monitoring: keeps the forecast for each upcoming or running Trip fresh. Each due Trip is
 * re-forecast through the normal Trip-date path, so history-on-change and level-change notices
 * apply exactly as when a traveller opens the Trip.
 */
@Injectable()
export class TripWeatherMonitorService {
	private readonly logger = new Logger(TripWeatherMonitorService.name);

	constructor(
		private readonly forecastsRepository: TripWeatherForecastsRepository,
		private readonly forecastService: TripWeatherForecastService
	) {}

	async checkDueTrips(
		batchSize: number,
		now: Date = new Date()
	): Promise<TripWeatherMonitorRunResult> {
		const tripIds = await this.forecastsRepository.findDueTripIds(now, {
			horizonMs: WEATHER_FORECAST_HORIZON_DAYS * DAY_MS,
			nearWindowMs: TRIP_WEATHER_MONITOR_NEAR_WINDOW_MS,
			nearIntervalMs: TRIP_WEATHER_MONITOR_NEAR_INTERVAL_MS,
			farIntervalMs: TRIP_WEATHER_MONITOR_FAR_INTERVAL_MS,
			limit: batchSize,
		});
		let failed = 0;
		// One Trip at a time keeps the load on the free weather provider predictable.
		for (const tripId of tripIds) {
			const forecast = await this.forecastService.tryEnsureTripForecast(tripId, now);
			if (!forecast) failed += 1;
		}
		if (tripIds.length > 0) {
			this.logger.log(
				`Trip weather monitor checked ${tripIds.length} trip(s), ${failed} without a forecast`
			);
		}
		return { checked: tripIds.length, failed };
	}

	/** Trims the history of long-finished Trips, keeping the forecast attached at submission. */
	async trimEndedTripHistory(now: Date = new Date()): Promise<number> {
		const removed = await this.forecastsRepository.deleteEndedTripHistory(
			new Date(now.getTime() - TRIP_WEATHER_HISTORY_RETENTION_MS)
		);
		if (removed > 0) this.logger.log(`Trimmed ${removed} forecast row(s) of ended trips`);
		return removed;
	}
}
