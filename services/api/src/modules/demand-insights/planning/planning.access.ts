import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { type DemandRelease, fingerprint } from "../demand-insights.policy";
import type { DemandInsightsProvider } from "../demand-insights.provider";
import type { DemandInsightsRepository } from "../demand-insights.repository";
import { planningSources } from "./planning.context";
import type { PlanningContext } from "./planning.policy";
export interface PlanningReport {
	id: string;
	month: string;
	status: string;
	window_start: Date;
	window_end: Date;
	source_hash: string;
	config_hash: string;
	release: DemandRelease;
}
export async function planningAccess(
	m: EntityManager,
	month: string,
	repository: DemandInsightsRepository,
	provider: DemandInsightsProvider
) {
	const [report]: PlanningReport[] = await m.query(
		"SELECT * FROM demand_insight_reports WHERE month=$1",
		[month]
	);
	if (!report) throw new NotFoundException("Demand report not found");
	const [frozen]: { context: PlanningContext; source_hash: string }[] = await m.query(
		"SELECT context,source_hash FROM demand_planning_contexts WHERE report_id=$1",
		[report.id]
	);
	const rows = await repository.source(m, report.window_start, report.window_end);
	const stale =
		report.source_hash !== fingerprint(rows) ||
		report.config_hash !== fingerprint(provider.configuration());
	const sources = await planningSources(m, rows);
	const usable =
		report.status === "succeeded" &&
		!!frozen &&
		!stale &&
		frozen.source_hash === fingerprint(sources) &&
		sources.every((r) => r.areaCode === null || r.areaActive === true);
	return {
		report,
		context: frozen?.context ?? null,
		stale: stale || (!!frozen && frozen.source_hash !== fingerprint(sources)),
		usable,
	};
}
