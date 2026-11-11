import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { AnalysisProviderError } from "../../review-analysis/review-analysis.types";
import { fingerprint } from "../demand-insights.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { type DemandConfiguration, DemandInsightsProvider } from "../demand-insights.provider";
import { type PlanningCandidate, validatePlanning } from "./planning.policy";
export type PlanningConfiguration = Omit<DemandConfiguration, "promptVersion"> & {
	promptVersion: "planning-v1";
};
export const planningConfigHash = (config: PlanningConfiguration) =>
	fingerprint(Object.fromEntries(Object.entries(config).sort(([a], [b]) => a.localeCompare(b))));
@Injectable()
export class PlanningProvider {
	constructor(
		private readonly env: ConfigService,
		private readonly demand: DemandInsightsProvider
	) {}
	configuration(): PlanningConfiguration {
		return { ...this.demand.configuration(), promptVersion: "planning-v1" };
	}
	async generate(
		month: string,
		candidates: PlanningCandidate[],
		config: PlanningConfiguration,
		signal: AbortSignal
	) {
		const token = this.env.get<string>("AI_REVIEW_SERVICE_TOKEN");
		if (!token) throw new AnalysisProviderError("provider_not_configured", false);
		try {
			const response = await fetch(
				`${this.env.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000"}/demand-planning`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
					body: JSON.stringify({
						month,
						candidates,
						model: config.model,
						prompt_version: config.promptVersion,
					}),
					signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
				}
			);
			if (!response.ok) {
				const raw: unknown = await response.json().catch(() => null);
				const detail = raw && typeof raw === "object" && "detail" in raw ? raw.detail : null;
				const code =
					detail && typeof detail === "object" && "code" in detail
						? String(detail.code)
						: "provider_failure";
				const terminal = [
					"invalid_output",
					"provider_refusal",
					"provider_not_configured",
					"insufficient_quota",
					"credit_balance_exhausted",
					"organization_spend_limit_exceeded",
					"project_spend_limit_exceeded",
					"organization_usage_limit_exceeded",
				].includes(code);
				throw new AnalysisProviderError(
					terminal ? code : "provider_failure",
					!terminal && (response.status >= 500 || response.status === 429)
				);
			}
			try {
				return validatePlanning(await response.json(), candidates);
			} catch {
				throw new AnalysisProviderError("invalid_output", false);
			}
		} catch (error) {
			if (error instanceof AnalysisProviderError) throw error;
			throw new AnalysisProviderError("provider_transport", true);
		}
	}
}
