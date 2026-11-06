import { randomUUID } from "node:crypto";
import { HttpException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import type { EntityManager } from "typeorm";
import { AnalysisProviderError } from "../review-analysis/review-analysis.types";
import {
	type DemandRelease,
	type DemandSuggestion,
	assertSettled,
	fingerprint,
	monthWindow,
	releaseDemand,
	validateSuggestions,
} from "./demand-insights.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { type DemandConfiguration, DemandInsightsProvider } from "./demand-insights.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsRepository } from "./demand-insights.repository";
interface Report {
	id: string;
	month: string;
	window_start: Date;
	window_end: Date;
	source_hash: string;
	config_hash: string;
	configuration: DemandConfiguration;
	release: DemandRelease;
	suggestions: DemandSuggestion[];
	status: "pending" | "running" | "succeeded" | "failed" | "insufficient_data";
	attempts: number;
	lease_token: string;
	generated_at: Date | null;
	error_code: string | null;
}
@Injectable()
export class DemandInsightsService {
	constructor(
		private readonly db: DataSource,
		private readonly repository: DemandInsightsRepository,
		private readonly provider: DemandInsightsProvider
	) {}
	async create(actor: string, month: string) {
		const window = monthWindow(month);
		return this.db.transaction("READ COMMITTED", async (m) => {
			await this.repository.authorize(m, actor);
			// Acquire the global control lock before reading the month to serialize concurrent creators.
			await m.query("SELECT id FROM demand_insight_control WHERE id=1 FOR UPDATE");
			const [existing]: Report[] = await m.query(
				"SELECT * FROM demand_insight_reports WHERE month=$1",
				[month]
			);
			if (existing) return { version: existing.id, month, status: existing.status, reused: true };
			const config = this.provider.configuration();
			assertSettled(window.end, config.minDaysAfterClose);
			const rows = await this.repository.source(m, window.start, window.end);
			const release = releaseDemand(rows, config);
			if (release.cells.length) {
				const [gate]: { wait: number }[] = await m.query(
					"SELECT GREATEST(0,ceil(60-extract(epoch FROM (clock_timestamp()-last_created_at))))::int AS wait FROM demand_insight_control WHERE id=1"
				);
				if (gate.wait > 0)
					throw new HttpException(
						{ message: "Demand generation cooldown", retryAfterSeconds: gate.wait },
						429
					);
				await m.query(
					"UPDATE demand_insight_control SET last_created_at=clock_timestamp() WHERE id=1"
				);
			}
			const [report]: Report[] = await m.query(
				`INSERT INTO demand_insight_reports(month,window_start,window_end,source_hash,config_hash,configuration,release,status,generated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='insufficient_data' THEN clock_timestamp() END) RETURNING *`,
				[
					month,
					window.start,
					window.end,
					fingerprint(rows),
					fingerprint(config),
					JSON.stringify(config),
					JSON.stringify(release),
					release.cells.length ? "pending" : "insufficient_data",
				]
			);
			return { version: report.id, month, status: report.status, reused: false };
		});
	}
	async read(actor: string, month: string) {
		monthWindow(month);
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await this.repository.authorize(m, actor);
			const [report]: Report[] = await m.query(
				"SELECT * FROM demand_insight_reports WHERE month=$1",
				[month]
			);
			if (!report) throw new NotFoundException("Demand report not found");
			const config = this.provider.configuration();
			const rows = await this.repository.source(m, report.window_start, report.window_end);
			const current = releaseDemand(rows, config, report.release.granularity);
			const restricted = report.release.cells.some(
				(c) =>
					!current.cells.some((n) => n.tripType === c.tripType && n.difficulty === c.difficulty)
			);
			return this.publicReport(
				report,
				report.source_hash !== fingerprint(rows) || report.config_hash !== fingerprint(config),
				restricted
			);
		});
	}
	private publicReport(report: Report, stale: boolean, restricted: boolean) {
		const visible = report.status === "succeeded" && !restricted;
		return {
			version: report.id,
			month: report.month,
			dataWindow: { start: report.window_start, end: report.window_end },
			generatedAt: report.generated_at,
			status: restricted && report.status === "succeeded" ? "withheld" : report.status,
			stale,
			granularity: visible ? report.release.granularity : null,
			cells: visible ? report.release.cells : [],
			suggestions: visible ? report.suggestions : [],
			errorCode: report.status === "failed" ? "analysis_unavailable" : null,
			advisory: "observed_booking_demand_not_a_forecast",
		};
	}
	async claim(): Promise<Report | null> {
		return this.db.transaction(async (m) => {
			const locks: { id: number }[] = await m.query(
				"SELECT id FROM demand_insight_control WHERE id=1 FOR UPDATE SKIP LOCKED"
			);
			if (!locks.length) return null;
			await m.query(
				"UPDATE demand_insight_reports SET status='failed',error_code='attempt_limit',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<=clock_timestamp() AND attempts>=3"
			);
			const active: { id: string }[] = await m.query(
				"SELECT id FROM demand_insight_reports WHERE status='running' AND lease_until>clock_timestamp() LIMIT 1"
			);
			if (active.length) return null;
			const [report]: Report[] = await m.query(
				`SELECT * FROM demand_insight_reports WHERE attempts<3 AND ((status='pending' AND next_attempt_at<=clock_timestamp()) OR (status='running' AND lease_until<=clock_timestamp())) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`
			);
			if (!report) return null;
			const [claim]: Report[] = await m.query(
				"WITH claimed AS (UPDATE demand_insight_reports SET status='running',attempts=attempts+1,lease_token=$2,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=$1 RETURNING *) SELECT * FROM claimed",
				[report.id, randomUUID()]
			);
			return claim;
		});
	}
	async heartbeat(report: Report): Promise<boolean> {
		const rows: { id: string }[] = await this.db.query(
			"WITH renewed AS (UPDATE demand_insight_reports SET lease_until=clock_timestamp()+interval '60 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM renewed",
			[report.id, report.lease_token]
		);
		return rows.length > 0;
	}
	async finish(
		report: Report,
		suggestions: DemandSuggestion[] | null,
		error?: AnalysisProviderError
	): Promise<boolean> {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			const [owned]: Report[] = await m.query(
				"SELECT * FROM demand_insight_reports WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>clock_timestamp() FOR UPDATE",
				[report.id, report.lease_token]
			);
			if (!owned) return false;
			const changed = !(await this.sourceMatches(m, report));
			const retry = !changed && !!error?.retryable && owned.attempts < 3;
			const saved: { id: string }[] = await m.query(
				`WITH saved AS (UPDATE demand_insight_reports SET status=$3,suggestions=$4,error_code=$5,generated_at=CASE WHEN $3='succeeded' THEN clock_timestamp() ELSE generated_at END,
	lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+($6::int*interval '1 second') WHERE id=$1 AND lease_token=$2 AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM saved`,
				[
					report.id,
					report.lease_token,
					changed ? "failed" : retry ? "pending" : suggestions ? "succeeded" : "failed",
					JSON.stringify(changed ? [] : (suggestions ?? [])),
					changed ? "source_or_config_changed" : (error?.code ?? null),
					owned.attempts === 1 ? 5 : 30,
				]
			);
			return saved.length > 0;
		});
	}
	private async sourceMatches(m: EntityManager, report: Report) {
		return (
			report.source_hash ===
				fingerprint(await this.repository.source(m, report.window_start, report.window_end)) &&
			report.config_hash === fingerprint(this.provider.configuration())
		);
	}
	async processOne(): Promise<boolean> {
		const claim = await this.claim();
		if (!claim) return false;
		const abort = new AbortController();
		const heartbeat = setInterval(() => {
			void this.heartbeat(claim)
				.then((ok) => {
					if (!ok) abort.abort();
				})
				.catch(() => abort.abort());
		}, 20000);
		heartbeat.unref();
		try {
			if (!(await this.sourceMatches(this.db.manager, claim))) {
				await this.finish(claim, null);
				return true;
			}
			const output = validateSuggestions(
				{
					suggestions: await this.provider.generate(
						claim.month,
						claim.release.cells,
						claim.configuration,
						abort.signal
					),
				},
				claim.release.cells
			);
			await this.finish(claim, output);
		} catch (error) {
			await this.finish(
				claim,
				null,
				error instanceof AnalysisProviderError
					? error
					: error instanceof Error && error.message === "invalid_output"
						? new AnalysisProviderError("invalid_output", false)
						: new AnalysisProviderError("provider_unavailable", true)
			);
		} finally {
			clearInterval(heartbeat);
		}
		return true;
	}
}
