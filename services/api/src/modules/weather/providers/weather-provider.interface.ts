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
