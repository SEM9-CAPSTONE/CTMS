import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { AnalysisProviderError } from "../review-analysis/review-analysis.types";
import { type DemandCell, type DemandPolicy, validateSuggestions } from "./demand-insights.policy";
export interface DemandConfiguration extends DemandPolicy {
	minDaysAfterClose: number;
	provider: string;
	model: string;
	configVersion: string;
	promptVersion: "demand-v1";
}
@Injectable()
export class DemandInsightsProvider {
	constructor(private readonly env: ConfigService) {}
	configuration(): DemandConfiguration {
		const minBookers = Number(this.env.get("DEMAND_MIN_BOOKERS") ?? 10);
		const minHosts = Number(this.env.get("DEMAND_MIN_HOSTS") ?? 3);
		const maxHostShare = Number(this.env.get("DEMAND_MAX_HOST_SHARE") ?? 0.75);
		const minDaysAfterClose = Number(this.env.get("DEMAND_MIN_DAYS_AFTER_CLOSE") ?? 3);
		const provider = this.env.get<string>("REVIEW_ANALYSIS_PROVIDER") ?? "openai";
		if (
			!Number.isInteger(minBookers) ||
			minBookers < 10 ||
			!Number.isInteger(minHosts) ||
			minHosts < 3 ||
			!Number.isFinite(maxHostShare) ||
			maxHostShare <= 0 ||
			maxHostShare > 0.8 ||
			!Number.isInteger(minDaysAfterClose) ||
			minDaysAfterClose < 1 ||
			minDaysAfterClose > 31 ||
			!["openai", "gemini"].includes(provider)
		)
			throw new AnalysisProviderError("provider_not_configured", false);
		return {
			minBookers,
			minHosts,
			maxHostShare,
			minDaysAfterClose,
			provider,
			model:
				this.env.get<string>("REVIEW_ANALYSIS_MODEL") ??
				(provider === "gemini" ? "gemini-3.1-flash-lite" : "gpt-4o-mini"),
			configVersion: this.env.get<string>("DEMAND_CONFIG_VERSION") ?? "v1",
			promptVersion: "demand-v1",
		};
	}
	async generate(
		month: string,
		cells: DemandCell[],
		config: DemandConfiguration,
		signal?: AbortSignal
	) {
		const token = this.env.get<string>("AI_REVIEW_SERVICE_TOKEN");
		if (!token) throw new AnalysisProviderError("provider_not_configured", false);
		try {
			const response = await fetch(
				`${this.env.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000"}/demand-insight`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
					body: JSON.stringify({
						month,
						cells,
						model: config.model,
						prompt_version: config.promptVersion,
					}),
					signal: signal
						? AbortSignal.any([signal, AbortSignal.timeout(15000)])
						: AbortSignal.timeout(15000),
				}
			);
			if (!response.ok) {
				const raw: unknown = await response.json().catch(() => null);
				const detail = raw && typeof raw === "object" && "detail" in raw ? raw.detail : null;
				const code = detail && typeof detail === "object" && "code" in detail ? detail.code : null;
				const terminal = [
					"invalid_output",
					"provider_refusal",
					"provider_not_configured",
					"insufficient_quota",
					"credit_balance_exhausted",
					"organization_spend_limit_exceeded",
					"project_spend_limit_exceeded",
					"organization_usage_limit_exceeded",
				].includes(String(code));
				throw new AnalysisProviderError(
					terminal ? String(code) : "provider_unavailable",
					!terminal && (response.status >= 500 || response.status === 429)
				);
			}
			try {
				return validateSuggestions(await response.json(), cells);
			} catch {
				throw new AnalysisProviderError("invalid_output", false);
			}
		} catch (error) {
			if (error instanceof AnalysisProviderError) throw error;
			throw new AnalysisProviderError("provider_transport", true);
		}
	}
}
