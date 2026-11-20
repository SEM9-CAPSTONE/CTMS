import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { ConfigService } from "@nestjs/config";
import { HOST_PLANNING_PROMPT_VERSION, type RouteCandidate } from "./host-analytics.policy";

export class HostAnalyticsAiError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly retryable: boolean
	) {
		super(message);
	}
}

export interface HostTripPlanningPayloadCandidate {
	candidateId: string;
	tripType: "day_trip" | "overnight";
	priceBand: string | null;
	capacityBand: string | null;
	fillBand: "low" | "medium" | "high" | "unknown";
	revenueRank: number;
	allowedMonths: string[];
	missingData: string[];
}

export interface HostTripPlanningAiResponse {
	selections: Array<{
		candidateId: string;
		monthHint: string;
		rationaleCodes: string[];
	}>;
}

@Injectable()
export class HostAnalyticsAiProvider {
	constructor(private readonly configService: ConfigService) {}

	private getBaseUrl(): string {
		return (
			this.configService.get<string>("AI_SERVICE_URL")?.replace(/\/+$/, "") ||
			"http://localhost:8000"
		);
	}

	private getModel(): string {
		const explicit = this.configService.get<string>("REVIEW_ANALYSIS_MODEL")?.trim();
		if (explicit) return explicit;
		const provider = (
			this.configService.get<string>("REVIEW_ANALYSIS_PROVIDER") ?? "openai"
		).toLowerCase();
		return provider === "gemini" ? "gemini-3.1-flash-lite" : "gpt-4o-mini";
	}

	async generatePlanningSelections(
		candidates: RouteCandidate[],
		signal?: AbortSignal
	): Promise<HostTripPlanningAiResponse> {
		// Strictly send ONLY relative/banded candidate fields (no hostId, routeName, revenue, booking IDs)
		const safeCandidates: HostTripPlanningPayloadCandidate[] = candidates.map((c) => ({
			candidateId: c.candidateId,
			tripType: c.tripType,
			priceBand: c.priceBand,
			capacityBand: c.capacityBand,
			fillBand: c.fillBand,
			revenueRank: c.revenueRank,
			allowedMonths: c.allowedMonths,
			missingData: c.missingData,
		}));

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		const token = this.configService.get<string>("AI_REVIEW_SERVICE_TOKEN")?.trim();
		if (token) {
			headers["X-CTMS-AI-Token"] = token;
		}

		const timeoutSignal = AbortSignal.timeout(45_000);
		const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

		let response: Response;
		try {
			response = await fetch(`${this.getBaseUrl()}/host-trip-planning`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					candidates: safeCandidates,
					model: this.getModel(),
					prompt_version: HOST_PLANNING_PROMPT_VERSION,
				}),
				signal: combinedSignal,
			});
		} catch (error) {
			throw new HostAnalyticsAiError(
				error instanceof Error ? error.message : "AI transport failure",
				"analysis_unavailable",
				true
			);
		}

		if (!response.ok) {
			const retryable = response.status === 429 || response.status >= 500;
			throw new HostAnalyticsAiError(
				`AI service returned HTTP ${response.status}`,
				"analysis_unavailable",
				retryable
			);
		}

		const data = (await response.json()) as unknown;
		if (
			!data ||
			typeof data !== "object" ||
			!Array.isArray((data as Record<string, unknown>).selections)
		) {
			throw new HostAnalyticsAiError("Invalid AI planning output", "analysis_unavailable", false);
		}

		return data as HostTripPlanningAiResponse;
	}
}
