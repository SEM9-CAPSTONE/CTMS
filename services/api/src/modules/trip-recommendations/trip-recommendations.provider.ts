import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import type { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import type { TripType } from "../trips/entities/trip.entity";
import type {
	PriceBand,
	RECOMMENDATION_PROMPT_VERSION,
	RecommendationFallbackReason,
	RecommendationReason,
	RecommendationSignalType,
} from "./trip-recommendation.policy";
import type { TripRegionCode } from "./trip-regions";

export const AI_RECOMMENDATION_TIMEOUT_MS = 5000;

/**
 * Everything the ranker receives: temporary candidate codes and structured attributes, plus the
 * aggregated signal. No Trip id, title, description, Host, Camper identity, booking or payment data.
 */
export interface AiRecommendationRequest {
	prompt_version: typeof RECOMMENDATION_PROMPT_VERSION;
	model: string;
	signal: Exclude<RecommendationSignalType, "none" | "health_profile">;
	preferences: {
		activities: string[];
		experienceYears: number | null;
		tripTypes: TripType[];
		difficulties: TrekkingRouteDifficulty[];
		regions: TripRegionCode[];
		hasPriceRange: boolean;
	};
	history: {
		bookingCount: number;
		tripType: Partial<Record<TripType, number>>;
		difficulty: Partial<Record<TrekkingRouteDifficulty, number>>;
		region: Partial<Record<TripRegionCode, number>>;
		priceBand: Partial<Record<PriceBand, number>>;
	};
	candidates: Array<{
		code: string;
		activities: string[];
		tripType: TripType;
		difficulty: TrekkingRouteDifficulty | null;
		region: TripRegionCode | null;
		priceBand: PriceBand;
		durationNights: number;
		daysUntilStart: number;
		baseScore: number;
		allowedReasons: RecommendationReason[];
	}>;
}

export class RecommendationAiError extends Error {
	constructor(readonly reason: RecommendationFallbackReason) {
		super(`Trip recommendation AI unavailable: ${reason}`);
		this.name = "RecommendationAiError";
	}
}

@Injectable()
export class TripRecommendationsProvider {
	constructor(private readonly config: ConfigService) {}

	/** Null when the AI ranker is switched off or not configured; the rule order is used instead. */
	modelVersion(): string | null {
		if (this.config.get<string>("TRIP_RECOMMENDATION_AI_ENABLED") === "false") return null;
		if (!this.config.get<string>("AI_REVIEW_SERVICE_TOKEN")) return null;
		if ((this.config.get<string>("TRIP_RECOMMENDATION_PROVIDER") ?? "gemini") !== "gemini") {
			return null;
		}
		return this.config.get<string>("TRIP_RECOMMENDATION_MODEL")?.trim() || "gemini-3.1-flash-lite";
	}

	/**
	 * How long an AI order is reused while the Camper's signals stay the same. Bounded so Trips
	 * published later are eventually ranked by the AI too (until then they follow in base order).
	 */
	cacheTtlMs(): number {
		const hours = Number(this.config.get<string>("TRIP_RECOMMENDATION_CACHE_HOURS") ?? 24);
		return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
	}

	/** Returns the raw parsed body; the service validates it against the candidates it sent. */
	async rank(request: AiRecommendationRequest): Promise<unknown> {
		const token = this.config.get<string>("AI_REVIEW_SERVICE_TOKEN");
		if (!token) throw new RecommendationAiError("ai_not_configured");
		const baseUrl = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
		let response: Response;
		try {
			response = await fetch(`${baseUrl}/trip-recommendations`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
				body: JSON.stringify(request),
				signal: AbortSignal.timeout(AI_RECOMMENDATION_TIMEOUT_MS),
			});
		} catch (error) {
			const name = error instanceof Error ? error.name : "";
			throw new RecommendationAiError(
				name === "TimeoutError" || name === "AbortError" ? "ai_timeout" : "ai_unavailable"
			);
		}
		if (!response.ok) {
			const body: unknown = await response.json().catch(() => null);
			const detail =
				body && typeof body === "object" && "detail" in body ? (body.detail as unknown) : null;
			const code =
				detail && typeof detail === "object" && "code" in detail ? String(detail.code) : null;
			if (code === "provider_not_configured") throw new RecommendationAiError("ai_not_configured");
			if (code === "invalid_output" || code === "provider_refusal") {
				throw new RecommendationAiError("ai_invalid_output");
			}
			throw new RecommendationAiError(response.status === 504 ? "ai_timeout" : "ai_unavailable");
		}
		try {
			return await response.json();
		} catch (error) {
			const name = error instanceof Error ? error.name : "";
			throw new RecommendationAiError(
				name === "TimeoutError" || name === "AbortError" ? "ai_timeout" : "ai_invalid_output"
			);
		}
	}
}
