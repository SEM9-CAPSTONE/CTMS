import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";

export const WEATHER_RISK_REVIEW_PROVIDER = Symbol("WEATHER_RISK_REVIEW_PROVIDER");

/** Raw worst-hour readings only: the AI never sees the thresholds or the rule-based level. */
export interface WeatherRiskReviewInput {
	rainfallMm: number;
	windKph: number;
	temperatureC: number;
	visibilityM: number;
	thunderstorm: boolean;
	hoursCovered: number;
}

export interface WeatherRiskReviewResult {
	level: RiskLevel;
	reason: string;
	confidence: number;
	model: string;
}

export interface WeatherRiskReviewProvider {
	/** False when the AI service is not configured; callers then skip the review entirely. */
	isConfigured(): boolean;
	/** @throws WeatherRiskReviewError on any failure or malformed answer. */
	review(input: WeatherRiskReviewInput): Promise<WeatherRiskReviewResult>;
}

export class WeatherRiskReviewError extends Error {
	constructor(
		readonly code: string,
		/** True when another attempt later may succeed (timeouts, 429, 5xx). */
		readonly retryable: boolean
	) {
		super(code);
		this.name = "WeatherRiskReviewError";
	}
}

const DEFAULT_TIMEOUT_MS = 15000;
const LEVELS = new Set<string>(Object.values(RiskLevel));

/** Calls `POST {AI_SERVICE_URL}/weather-risk-review` with the internal AI service token. */
@Injectable()
export class HttpWeatherRiskReviewProvider implements WeatherRiskReviewProvider {
	constructor(private readonly config: ConfigService) {}

	isConfigured(): boolean {
		return Boolean(this.config.get<string>("AI_REVIEW_SERVICE_TOKEN")?.trim());
	}

	async review(input: WeatherRiskReviewInput): Promise<WeatherRiskReviewResult> {
		const token = this.config.get<string>("AI_REVIEW_SERVICE_TOKEN")?.trim();
		if (!token) throw new WeatherRiskReviewError("provider_not_configured", false);
		const baseUrl = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
		const timeoutMs = Number(
			this.config.get<string>("AI_SERVICE_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS
		);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		let response: Response;
		try {
			response = await fetch(`${baseUrl}/weather-risk-review`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
				body: JSON.stringify({
					rainfall_mm: input.rainfallMm,
					wind_kph: input.windKph,
					temperature_c: input.temperatureC,
					visibility_m: input.visibilityM,
					thunderstorm: input.thunderstorm,
					hours_covered: input.hoursCovered,
				}),
				signal: controller.signal,
			});
		} catch {
			throw new WeatherRiskReviewError("provider_transport", true);
		} finally {
			clearTimeout(timeout);
		}

		if (!response.ok) {
			const retryable = response.status === 429 || response.status >= 500;
			throw new WeatherRiskReviewError(`provider_http_${response.status}`, retryable);
		}
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new WeatherRiskReviewError("invalid_output", true);
		}
		return parseReview(body);
	}
}

export function parseReview(body: unknown): WeatherRiskReviewResult {
	const value = (body ?? {}) as Record<string, unknown>;
	const { level, reason, confidence, model } = value;
	if (
		typeof level !== "string" ||
		!LEVELS.has(level) ||
		typeof reason !== "string" ||
		reason.trim().length === 0 ||
		typeof confidence !== "number" ||
		!Number.isFinite(confidence) ||
		confidence < 0 ||
		confidence > 1 ||
		typeof model !== "string" ||
		model.trim().length === 0
	) {
		throw new WeatherRiskReviewError("invalid_output", true);
	}
	return {
		level: level as RiskLevel,
		reason: reason.trim().slice(0, 600),
		confidence,
		model: model.trim().slice(0, 200),
	};
}
