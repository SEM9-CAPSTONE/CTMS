import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { validateOutput } from "./review-analysis.policy";
import {
	type AnalysisConfig,
	type AnalysisOutput,
	AnalysisProviderError,
	PROMPT_VERSION,
} from "./review-analysis.types";

@Injectable()
export class ReviewAnalysisProvider {
	constructor(private readonly config: ConfigService) {}
	configuration(): AnalysisConfig {
		const provider = this.config.get<string>("REVIEW_ANALYSIS_PROVIDER") ?? "openai";
		if (provider !== "openai" && provider !== "gemini")
			throw new AnalysisProviderError("provider_not_configured", false);
		return {
			provider,
			model:
				this.config.get<string>("REVIEW_ANALYSIS_MODEL") ??
				(provider === "gemini" ? "gemini-3.1-flash-lite" : "gpt-4o-mini"),
			configVersion: this.config.get<string>("REVIEW_ANALYSIS_CONFIG_VERSION") ?? "v1",
			promptVersion: PROMPT_VERSION,
		};
	}
	async generate(
		comment: string,
		config: AnalysisConfig,
		signal?: AbortSignal
	): Promise<AnalysisOutput> {
		const token = this.config.get<string>("AI_REVIEW_SERVICE_TOKEN");
		if (!token) throw new AnalysisProviderError("provider_not_configured", false);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		const abort = () => controller.abort();
		signal?.addEventListener("abort", abort, { once: true });
		try {
			const response = await fetch(
				`${this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000"}/review-analysis`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
					body: JSON.stringify({
						comment,
						model: config.model,
						config_version: config.configVersion,
						prompt_version: config.promptVersion,
					}),
					signal: controller.signal,
				}
			);
			let raw: unknown;
			try {
				raw = await response.json();
			} catch {
				if (!response.ok)
					throw new AnalysisProviderError(
						`provider_http_${response.status}`,
						response.status === 429 || response.status >= 500
					);
				throw new AnalysisProviderError("invalid_output", false);
			}
			if (!response.ok) {
				const detail = raw && typeof raw === "object" && "detail" in raw ? raw.detail : null;
				const code = detail && typeof detail === "object" && "code" in detail ? detail.code : null;
				if (
					typeof code === "string" &&
					[
						"credit_balance_exhausted",
						"insufficient_quota",
						"organization_spend_limit_exceeded",
						"project_spend_limit_exceeded",
						"organization_usage_limit_exceeded",
					].includes(code)
				) {
					throw new AnalysisProviderError(code, false);
				}
				if (code === "provider_not_configured")
					throw new AnalysisProviderError("provider_not_configured", false);
				if (code === "invalid_output" || code === "provider_refusal")
					throw new AnalysisProviderError(code, false);
				throw new AnalysisProviderError(
					response.status === 429 ? "provider_rate_limited" : `provider_http_${response.status}`,
					response.status === 429 || response.status >= 500
				);
			}
			return validateOutput(raw);
		} catch (error) {
			if (error instanceof AnalysisProviderError) throw error;
			throw new AnalysisProviderError(
				controller.signal.aborted ? "provider_timeout" : "provider_transport",
				true
			);
		} finally {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", abort);
		}
	}
}
