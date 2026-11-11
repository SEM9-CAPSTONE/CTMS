import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import {
	MODERATION_DEFAULT_CONFIG_VERSION,
	MODERATION_DEFAULT_MODEL,
	MODERATION_DEFAULT_PROMPT_VERSION,
	MODERATION_DEFAULT_PROVIDER,
} from "./trip-review-moderation.constants";
import type {
	AspectType,
	ImageScanStatus,
	IncidentOccurred,
	IncidentSeverity,
	IncidentType,
	ModerationConfig,
	ModerationFlagType,
	ModerationScanStatus,
	SentimentType,
} from "./trip-review-moderation.types";

export class ModerationProviderError extends Error {
	constructor(
		public readonly code: string,
		public readonly retryable: boolean
	) {
		super(code);
	}
}

export interface ProviderModerationResponse {
	text_scan_status: ModerationScanStatus;
	image_scan_status: ImageScanStatus;
	aspects_status: ModerationScanStatus;
	incidents_status: ModerationScanStatus;
	flags: Array<{
		flag_type: ModerationFlagType;
		confidence: number;
		evidence: string;
		quote: string;
	}>;
	image_items: Array<{
		image_index: number;
		storage_key: string;
		scan_status: "completed" | "unsupported" | "failed";
		has_violation?: boolean | null;
		flag_type?: "inappropriate_image" | null;
		confidence?: number | null;
		evidence?: string | null;
	}>;
	aspect_sentiments: Array<{
		aspect: AspectType;
		sentiment: SentimentType;
		confidence: number;
		quote?: string | null;
	}>;
	incident_signals: Array<{
		incident_type: IncidentType;
		occurred: IncidentOccurred;
		severity: IncidentSeverity;
		quote: string;
	}>;
}

@Injectable()
export class TripReviewModerationProvider {
	constructor(private readonly config: ConfigService) {}

	configuration(): ModerationConfig {
		const provider =
			this.config.get<string>("REVIEW_MODERATION_PROVIDER") ??
			this.config.get<string>("REVIEW_ANALYSIS_PROVIDER") ??
			MODERATION_DEFAULT_PROVIDER;
		const model =
			this.config.get<string>("REVIEW_MODERATION_MODEL") ??
			this.config.get<string>("REVIEW_ANALYSIS_MODEL") ??
			MODERATION_DEFAULT_MODEL;
		const configVersion =
			this.config.get<string>("REVIEW_MODERATION_CONFIG_VERSION") ??
			this.config.get<string>("REVIEW_ANALYSIS_CONFIG_VERSION") ??
			MODERATION_DEFAULT_CONFIG_VERSION;

		return {
			provider,
			model,
			configVersion,
			promptVersion: MODERATION_DEFAULT_PROMPT_VERSION,
		};
	}

	async scanReview(
		maskedComment: string | null,
		images: string[],
		moderationConfig: ModerationConfig,
		signal?: AbortSignal
	): Promise<ProviderModerationResponse> {
		const token = this.config.get<string>("AI_REVIEW_SERVICE_TOKEN");
		if (!token) throw new ModerationProviderError("provider_not_configured", false);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 20000);
		const abort = () => controller.abort();
		signal?.addEventListener("abort", abort, { once: true });

		try {
			const baseUrl = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
			const response = await fetch(`${baseUrl}/review-moderation-scan`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-CTMS-AI-Token": token,
				},
				body: JSON.stringify({
					comment: maskedComment,
					images,
					provider: moderationConfig.provider,
					model: moderationConfig.model,
					config_version: moderationConfig.configVersion,
					prompt_version: moderationConfig.promptVersion,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as {
					detail?: { code?: string };
				};
				const code = body?.detail?.code ?? "provider_failure";
				const retryable = response.status === 429 || response.status >= 500;
				throw new ModerationProviderError(code, retryable);
			}

			return (await response.json()) as ProviderModerationResponse;
		} catch (error) {
			if (error instanceof ModerationProviderError) throw error;
			const isAbort = error instanceof Error && error.name === "AbortError";
			throw new ModerationProviderError(
				isAbort ? "provider_transport" : "provider_failure",
				isAbort
			);
		} finally {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", abort);
		}
	}
}
