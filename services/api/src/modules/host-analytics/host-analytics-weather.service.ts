import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import {
	WEATHER_FORECAST_HORIZON_DAYS,
	WEATHER_PROVIDER,
	type WeatherProvider,
} from "../weather/providers/weather-provider.interface";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
import { scoreWeatherReading } from "../weather/services/weather-risk-scoring";
import type { SuggestionWeatherSummaryDto } from "./dto/host-analytics-response.dto";

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_AREAS_PER_JOB = 10;

interface CachedWeatherEntry {
	expiresAt: number;
	result: {
		riskLevel: "green" | "yellow" | "red";
		summary: string;
	};
}

@Injectable()
export class HostAnalyticsWeatherService {
	private readonly logger = new Logger(HostAnalyticsWeatherService.name);
	private readonly cache = new Map<string, CachedWeatherEntry>();

	constructor(
		@Optional()
		@Inject(WEATHER_PROVIDER)
		private readonly weatherProvider?: WeatherProvider,
		@Optional()
		private readonly weatherRiskRepository?: WeatherRiskRepository
	) {}

	/**
	 * Evaluates forecast risk for a candidate schedule window using Open-Meteo + active WeatherRiskRule.
	 * Strictly fail-open: if provider is unavailable/rate-limited or area budget exceeded, returns unavailable
	 * immediately without waiting or retrying so live trip monitoring is never delayed.
	 */
	async evaluateWindow(input: {
		areaKey: string;
		latitude: number | null;
		longitude: number | null;
		startsAt: Date | null;
		endsAt: Date | null;
		areasBudget: Set<string>;
		now?: Date;
	}): Promise<SuggestionWeatherSummaryDto> {
		const now = input.now ?? new Date();
		if (!input.startsAt || !input.endsAt) {
			return {
				status: "beyond_horizon",
				riskLevel: null,
				summary: "Chưa có dự báo cho thời điểm này",
				checkedDate: null,
			};
		}

		const checkedDate = input.startsAt.toISOString().slice(0, 10);
		const horizonEnd = new Date(
			Date.UTC(
				now.getUTCFullYear(),
				now.getUTCMonth(),
				now.getUTCDate() + WEATHER_FORECAST_HORIZON_DAYS,
				0,
				0,
				0
			)
		);
		if (
			input.startsAt.getTime() > horizonEnd.getTime() ||
			input.startsAt.getTime() < now.getTime()
		) {
			return {
				status: "beyond_horizon",
				riskLevel: null,
				summary: "Chưa có dự báo cho thời điểm này",
				checkedDate,
			};
		}

		if (
			input.latitude === null ||
			input.longitude === null ||
			!this.weatherProvider ||
			!this.weatherRiskRepository
		) {
			return {
				status: "unavailable",
				riskLevel: null,
				summary: "Tạm thời không có dữ liệu dự báo thời tiết",
				checkedDate,
			};
		}

		const cacheKey = `${input.areaKey}:${checkedDate}`;
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiresAt > now.getTime()) {
			return {
				status: "available",
				riskLevel: cached.result.riskLevel,
				summary: cached.result.summary,
				checkedDate,
			};
		}

		// Cap distinct areas queried per job to protect Open-Meteo rate limit for live trip monitoring
		if (!input.areasBudget.has(input.areaKey) && input.areasBudget.size >= MAX_AREAS_PER_JOB) {
			return {
				status: "unavailable",
				riskLevel: null,
				summary: "Tạm thời không có dữ liệu dự báo thời tiết",
				checkedDate,
			};
		}
		input.areasBudget.add(input.areaKey);

		try {
			const activeRule = await this.weatherRiskRepository.findActiveRule();
			if (!activeRule) {
				return {
					status: "unavailable",
					riskLevel: null,
					summary: "Tạm thời không có dữ liệu dự báo thời tiết",
					checkedDate,
				};
			}

			const effectiveEnd = new Date(
				Math.max(
					input.startsAt.getTime() + 3600_000,
					Math.min(input.endsAt.getTime(), horizonEnd.getTime())
				)
			);
			const forecast = await this.weatherProvider.fetchHourlyForecast(
				input.latitude,
				input.longitude,
				input.startsAt,
				effectiveEnd
			);
			if (!forecast.hours || forecast.hours.length === 0) {
				return {
					status: "unavailable",
					riskLevel: null,
					summary: "Tạm thời không có dữ liệu dự báo thời tiết",
					checkedDate,
				};
			}

			let worstLevel: "green" | "yellow" | "red" = "green";
			let maxRain = 0;
			let maxWind = 0;
			let minTemp = Number.POSITIVE_INFINITY;
			let maxTemp = Number.NEGATIVE_INFINITY;
			let hasThunderstorm = false;

			for (const hour of forecast.hours) {
				const scored = scoreWeatherReading(hour, activeRule);
				if (scored.riskLevel === RiskLevel.RED) {
					worstLevel = "red";
				} else if (scored.riskLevel === RiskLevel.YELLOW && worstLevel !== "red") {
					worstLevel = "yellow";
				}
				if (hour.rainfallMm > maxRain) maxRain = hour.rainfallMm;
				if (hour.windKph > maxWind) maxWind = hour.windKph;
				if (hour.temperatureC < minTemp) minTemp = hour.temperatureC;
				if (hour.temperatureC > maxTemp) maxTemp = hour.temperatureC;
				if (hour.thunderstorm) hasThunderstorm = true;
			}

			const summary = this.formatSummaryVi(
				worstLevel,
				maxRain,
				maxWind,
				minTemp,
				maxTemp,
				hasThunderstorm
			);
			this.cache.set(cacheKey, {
				expiresAt: now.getTime() + WEATHER_CACHE_TTL_MS,
				result: { riskLevel: worstLevel, summary },
			});

			return {
				status: "available",
				riskLevel: worstLevel,
				summary,
				checkedDate,
			};
		} catch (error) {
			// Fail-open immediately: never block suggestion job or retry on provider cooldown
			this.logger.warn(
				`Weather forecast skipped (fail-open) for ${input.areaKey}: ${error instanceof Error ? error.message : String(error)}`
			);
			return {
				status: "unavailable",
				riskLevel: null,
				summary: "Tạm thời không lấy được dự báo thời tiết",
				checkedDate,
			};
		}
	}

	private formatSummaryVi(
		riskLevel: "green" | "yellow" | "red",
		maxRain: number,
		maxWind: number,
		minTemp: number,
		maxTemp: number,
		hasThunderstorm: boolean
	): string {
		const levelLabel =
			riskLevel === "red"
				? "Rủi ro cao (Đỏ)"
				: riskLevel === "yellow"
					? "Cần lưu ý (Vàng)"
					: "Thuận lợi (Xanh)";
		const tempPart =
			Number.isFinite(minTemp) && Number.isFinite(maxTemp)
				? `Nhiệt độ ${Math.round(minTemp)}–${Math.round(maxTemp)}°C`
				: "";
		const rainPart = maxRain > 0 ? `mưa tối đa ${maxRain.toFixed(1)} mm/h` : "ít mưa";
		const windPart = `gió tối đa ${Math.round(maxWind)} km/h`;
		const stormPart = hasThunderstorm ? ", có khả năng dông" : "";
		return `${levelLabel}: ${[tempPart, rainPart, windPart].filter(Boolean).join(", ")}${stormPart}.`;
	}
}
