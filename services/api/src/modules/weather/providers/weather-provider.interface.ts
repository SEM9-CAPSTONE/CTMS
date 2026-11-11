export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");

export interface WeatherReading {
	/** The provider's own reported observation time. */
	observedAt: Date;
	rainfallMm: number;
	windKph: number;
	temperatureC: number;
	visibilityM: number;
	thunderstorm: boolean;
	/** Raw WMO weather code, kept for future rule tuning (see WeatherSnapshot). */
	providerWeatherCode: number;
	/** Full raw response, stored as-is for audit/debugging. */
	raw: Record<string, unknown>;
}

/**
 * CTMS-25-T01. One provider implementation today (Open-Meteo) -- this
 * interface exists so a later provider swap or fallback (BR-229/BR-230)
 * never touches WeatherService's own retry/persistence logic, the same
 * separation-of-concerns reasoning as auth's OtpNotificationProvider.
 */
export interface WeatherProvider {
	/**
	 * @throws WeatherProviderError on any non-2xx response, timeout, or
	 * malformed body -- WeatherService is the only place that decides what
	 * to do with a failure (retry, then persist a FAILED snapshot).
	 */
	fetchCurrent(latitude: number, longitude: number): Promise<WeatherReading>;

	/**
	 * Hourly forecast for the inclusive UTC window [from, to]. The caller keeps the
	 * window inside the provider horizon (`WEATHER_FORECAST_HORIZON_DAYS`).
	 * @throws WeatherProviderError like `fetchCurrent`.
	 */
	fetchHourlyForecast(
		latitude: number,
		longitude: number,
		from: Date,
		to: Date
	): Promise<WeatherHourlyForecast>;
}

/**
 * Open-Meteo serves hourly forecasts up to the end of the 15th day after today
 * (it rejects later `start_hour`/`end_hour` with "out of allowed range"), so a
 * Trip is forecast only when it starts within this many days.
 */
export const WEATHER_FORECAST_HORIZON_DAYS = 15;

export interface WeatherForecastHour {
	time: Date;
	rainfallMm: number;
	windKph: number;
	temperatureC: number;
	visibilityM: number;
	thunderstorm: boolean;
	providerWeatherCode: number;
}

export interface WeatherHourlyForecast {
	hours: WeatherForecastHour[];
	raw: Record<string, unknown>;
}

export class WeatherProviderError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = "WeatherProviderError";
	}
}
