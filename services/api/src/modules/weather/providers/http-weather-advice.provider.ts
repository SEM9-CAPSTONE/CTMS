import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import type {
	WeatherAdviceProvider,
	WeatherAdviceRequestPayload,
	WeatherAdviceResult,
} from "./weather-advice-provider.interface";
import { WeatherAdviceProviderError } from "./weather-advice-provider.interface";

const DEFAULT_TIMEOUT_MS = 15000;

interface AiServiceAdvisoryResponse {
	advice?: string;
	actions?: string[];
	detail?: string;
}

/**
 * CTMS-29-T01. Calls the project's own `services/ai` FastAPI microservice
 * (`POST {AI_SERVICE_URL}/weather-advisory`) -- not OpenAI directly. The
 * OpenAI API key lives only in the `ai` container's own environment (see
 * docker-compose.yml), never in `services/api`; this provider only ever
 * sees the `ai` service's own JSON contract, matching the field names its
 * Pydantic request/response models declare (services/ai/app/models.py).
 */
@Injectable()
export class HttpWeatherAdviceProvider implements WeatherAdviceProvider {
	private readonly logger = new Logger(HttpWeatherAdviceProvider.name);

	constructor(private readonly configService: ConfigService) {}

	async generate(payload: WeatherAdviceRequestPayload): Promise<WeatherAdviceResult> {
		const baseUrl = this.configService.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
		const timeoutMs = Number(
			this.configService.get<string>("AI_SERVICE_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS
		);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		let response: Response;
		try {
			response = await fetch(`${baseUrl}/weather-advisory`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					risk_level: payload.riskLevel,
					composite_score: payload.compositeScore,
					rainfall: payload.rainfall,
					wind: payload.wind,
					temperature: payload.temperature,
					visibility: payload.visibility,
					thunderstorm: payload.thunderstorm,
				}),
				signal: controller.signal,
			});
		} catch (error) {
			this.logger.error(`AI service request failed: ${(error as Error).message}`);
			throw new WeatherAdviceProviderError("Weather advice service request failed", error);
		} finally {
			clearTimeout(timeout);
		}

		let body: AiServiceAdvisoryResponse;
		try {
			body = (await response.json()) as AiServiceAdvisoryResponse;
		} catch (error) {
			throw new WeatherAdviceProviderError(
				"Weather advice service returned a malformed response",
				error
			);
		}

		if (!response.ok || !body.advice || !body.actions) {
			throw new WeatherAdviceProviderError(
				body.detail ?? `Weather advice service returned HTTP ${response.status}`
			);
		}

		return { adviceText: body.advice, actions: body.actions };
	}
}
