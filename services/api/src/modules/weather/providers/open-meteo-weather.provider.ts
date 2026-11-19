import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import type {
	WeatherForecastHour,
	WeatherHourlyForecast,
	WeatherProvider,
	WeatherReading,
} from "./weather-provider.interface";
import { WeatherProviderError } from "./weather-provider.interface";

const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_REQUESTS = 3;
const FAILURE_COOLDOWN_MS = 60_000;

/** WMO weather interpretation codes 95/96/99 are the standard's own
 * "thunderstorm" family (slight/moderate, with slight hail, with heavy
 * hail) -- https://open-meteo.com/en/docs, not a value this codebase
 * invented. */
const THUNDERSTORM_WMO_CODES = new Set([95, 96, 99]);

interface OpenMeteoCurrentResponse {
	current?: {
		time: string;
		temperature_2m: number;
		precipitation: number;
		rain: number;
		weather_code: number;
		wind_speed_10m: number;
		visibility: number;
	};
	error?: boolean;
	reason?: string;
}

interface OpenMeteoHourlyResponse {
	hourly?: {
		time: string[];
		temperature_2m: Array<number | null>;
		rain: Array<number | null>;
		weather_code: Array<number | null>;
		wind_speed_10m: Array<number | null>;
		visibility: Array<number | null>;
	};
	error?: boolean;
	reason?: string;
}

/**
 * CTMS-25-T01. Open-Meteo (https://open-meteo.com) -- chosen because it
 * needs no API key/account (Decision Gate: this project has no existing
 * weather-provider secret anywhere in .env), has a free tier, and its `current` block
 * carries every field BR-065 requires (rain, wind, temperature,
 * visibility) plus a WMO weather code standard enough to derive
 * `thunderstorm` from without inventing a threshold.
 */
@Injectable()
export class OpenMeteoWeatherProvider implements WeatherProvider {
	private readonly logger = new Logger(OpenMeteoWeatherProvider.name);
	private readonly inFlight = new Map<string, Promise<unknown>>();
	private readonly waiting: Array<() => void> = [];
	private activeRequests = 0;
	private unavailableUntil = 0;

	constructor(private readonly configService: ConfigService) {}

	async fetchCurrent(latitude: number, longitude: number): Promise<WeatherReading> {
		const url = new URL(OPEN_METEO_BASE_URL);
		url.searchParams.set("latitude", latitude.toString());
		url.searchParams.set("longitude", longitude.toString());
		url.searchParams.set(
			"current",
			"temperature_2m,precipitation,rain,weather_code,wind_speed_10m,visibility"
		);

		const body = await this.requestJson<OpenMeteoCurrentResponse>(url);
		if (!body.current) {
			throw new WeatherProviderError("Weather provider returned no current weather");
		}

		const current = body.current;
		return {
			// No `timezone` param is sent above, so Open-Meteo's own default
			// applies -- GMT (utc_offset_seconds=0, verified against a real
			// call), meaning `current.time` ("YYYY-MM-DDTHH:MM") is already
			// UTC and only needs seconds+offset appended to parse correctly.
			observedAt: new Date(`${current.time}:00Z`),
			rainfallMm: current.rain,
			windKph: current.wind_speed_10m,
			temperatureC: current.temperature_2m,
			visibilityM: current.visibility,
			thunderstorm: THUNDERSTORM_WMO_CODES.has(current.weather_code),
			providerWeatherCode: current.weather_code,
			raw: body as unknown as Record<string, unknown>,
		};
	}

	async fetchHourlyForecast(
		latitude: number,
		longitude: number,
		from: Date,
		to: Date
	): Promise<WeatherHourlyForecast> {
		const url = new URL(OPEN_METEO_BASE_URL);
		url.searchParams.set("latitude", latitude.toString());
		url.searchParams.set("longitude", longitude.toString());
		url.searchParams.set("hourly", "temperature_2m,rain,weather_code,wind_speed_10m,visibility");
		url.searchParams.set("timezone", "GMT");
		url.searchParams.set("start_hour", toOpenMeteoHour(floorToHour(from)));
		url.searchParams.set("end_hour", toOpenMeteoHour(floorToHour(to)));

		const body = await this.requestJson<OpenMeteoHourlyResponse>(url);
		const hourly = body.hourly;
		if (!hourly || !Array.isArray(hourly.time)) {
			throw new WeatherProviderError(body.reason ?? "Weather provider returned no hourly forecast");
		}

		const hours: WeatherForecastHour[] = [];
		hourly.time.forEach((time, index) => {
			const temperature = hourly.temperature_2m[index];
			const rain = hourly.rain[index];
			const code = hourly.weather_code[index];
			const wind = hourly.wind_speed_10m[index];
			const visibility = hourly.visibility[index];
			// Skip hours the model has not filled in rather than inventing values (BR-229).
			if ([temperature, rain, code, wind, visibility].some((value) => value == null)) return;
			hours.push({
				// timezone=GMT, so "YYYY-MM-DDTHH:MM" is already UTC.
				time: new Date(`${time}:00Z`),
				rainfallMm: rain as number,
				windKph: wind as number,
				temperatureC: temperature as number,
				visibilityM: visibility as number,
				thunderstorm: THUNDERSTORM_WMO_CODES.has(code as number),
				providerWeatherCode: code as number,
			});
		});
		if (hours.length === 0) {
			throw new WeatherProviderError("Weather provider returned no usable forecast hours");
		}
		return { hours, raw: body as unknown as Record<string, unknown> };
	}

	private async requestJson<T extends { error?: boolean; reason?: string }>(url: URL): Promise<T> {
		const key = url.toString();
		const pending = this.inFlight.get(key);
		if (pending) return pending as Promise<T>;
		const request = this.performRequest<T>(url);
		this.inFlight.set(key, request);
		try {
			return await request;
		} finally {
			this.inFlight.delete(key);
		}
	}

	private async performRequest<T extends { error?: boolean; reason?: string }>(
		url: URL
	): Promise<T> {
		this.assertAvailable();
		await this.acquireSlot();
		try {
			// A preceding request may have failed while this request was queued.
			this.assertAvailable();
			return await this.fetchJson<T>(url);
		} finally {
			const next = this.waiting.shift();
			if (next) next();
			else this.activeRequests--;
		}
	}

	private async acquireSlot(): Promise<void> {
		if (this.activeRequests < MAX_CONCURRENT_REQUESTS) {
			this.activeRequests++;
			return;
		}
		await new Promise<void>((resolve) => this.waiting.push(resolve));
	}

	private assertAvailable(): void {
		if (Date.now() < this.unavailableUntil) {
			throw new WeatherProviderError(
				"Weather provider is temporarily unavailable",
				undefined,
				false
			);
		}
	}

	private markUnavailable(message: string, delayMs = FAILURE_COOLDOWN_MS): void {
		if (Date.now() >= this.unavailableUntil) {
			this.logger.warn(`Open-Meteo unavailable; requests paused for ${delayMs}ms: ${message}`);
		}
		this.unavailableUntil = Math.max(this.unavailableUntil, Date.now() + delayMs);
	}

	private async fetchJson<T extends { error?: boolean; reason?: string }>(url: URL): Promise<T> {
		const configuredTimeout = Number(this.configService.get<string>("WEATHER_API_TIMEOUT_MS"));
		const timeoutMs =
			Number.isInteger(configuredTimeout) && configuredTimeout > 0
				? configuredTimeout
				: DEFAULT_TIMEOUT_MS;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) {
				const message = `Weather provider returned HTTP ${response.status}`;
				if (response.status === 429 || response.status >= 500) {
					const retryAfter = response.headers?.get("retry-after");
					const delayMs = retryAfter
						? Number.isFinite(Number(retryAfter))
							? Number(retryAfter) * 1000
							: Date.parse(retryAfter) - Date.now()
						: 0;
					this.markUnavailable(
						message,
						Number.isFinite(delayMs) ? Math.max(FAILURE_COOLDOWN_MS, delayMs) : FAILURE_COOLDOWN_MS
					);
					// Do not wait for an error body, which can itself stall or be invalid JSON.
					await response.body?.cancel();
					throw new WeatherProviderError(message, undefined, false);
				}
			}
			let body: T;
			try {
				body = (await response.json()) as T;
			} catch (error) {
				if (controller.signal.aborted) throw error;
				throw new WeatherProviderError("Weather provider returned a malformed response", error);
			}
			if (!response.ok || body.error) {
				throw new WeatherProviderError(
					body.reason ?? `Weather provider returned HTTP ${response.status}`,
					undefined,
					response.ok
				);
			}
			return body;
		} catch (error) {
			if (error instanceof WeatherProviderError) throw error;
			const message = controller.signal.aborted
				? `Weather provider timed out after ${timeoutMs}ms`
				: `Weather provider request failed: ${error instanceof Error ? error.message : String(error)}`;
			this.markUnavailable(message);
			throw new WeatherProviderError(message, error, false);
		} finally {
			// The timeout covers both response headers and reading the JSON body.
			clearTimeout(timeout);
		}
	}
}

function floorToHour(date: Date): Date {
	const copy = new Date(date.getTime());
	copy.setUTCMinutes(0, 0, 0);
	return copy;
}

function toOpenMeteoHour(date: Date): string {
	return date.toISOString().slice(0, 16);
}
