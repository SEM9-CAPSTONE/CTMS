import { randomUUID } from "node:crypto";
import { HttpException, Injectable, UnprocessableEntityException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import { AnalysisProviderError } from "../../review-analysis/review-analysis.types";
import { monthWindow } from "../demand-insights.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsProvider } from "../demand-insights.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsRepository } from "../demand-insights.repository";
import { planningAccess } from "./planning.access";
import { type PlanningChoice, presentPlanning, validatePlanning } from "./planning.policy";
// biome-ignore lint/style/useImportType: Nest injection
import {
	type PlanningConfiguration,
	PlanningProvider,
	planningConfigHash,
} from "./planning.provider";
interface PlanningJob {
	id: string;
	report_id: string;
	month: string;
	configuration: PlanningConfiguration;
	status: "pending" | "running" | "succeeded" | "failed";
	attempts: number;
	lease_token: string;
	output: PlanningChoice[];
	generated_at: Date | null;
}
@Injectable()
export class PlanningService {
	constructor(
		private readonly db: DataSource,
		private readonly repository: DemandInsightsRepository,
		private readonly demand: DemandInsightsProvider,
		private readonly provider: PlanningProvider
	) {}
	async create(actor: string, month: string) {
		monthWindow(month);
		return this.db.transaction(async (m) => {
			await this.repository.authorize(m, actor);
			await m.query("SELECT id FROM demand_planning_control WHERE id=1 FOR UPDATE");
			const access = await planningAccess(m, month, this.repository, this.demand);
			if (!access.context) throw new UnprocessableEntityException({ code: "planning_unavailable" });
			if (!access.usable)
				throw new UnprocessableEntityException({
					code: access.stale ? "context_stale" : "report_not_ready",
				});
			const [existing]: PlanningJob[] = await m.query(
				"SELECT * FROM demand_planning_jobs WHERE report_id=$1",
				[access.report.id]
			);
			if (existing) return { status: existing.status, reused: true };
			const [gate]: { wait: number }[] = await m.query(
				"SELECT GREATEST(0,ceil(60-extract(epoch FROM(clock_timestamp()-last_created_at))))::int AS wait FROM demand_planning_control WHERE id=1"
			);
			if (gate.wait > 0) throw new HttpException({ retryAfterSeconds: gate.wait }, 429);
			const [job]: PlanningJob[] = await m.query(
				"INSERT INTO demand_planning_jobs(report_id,configuration,status) VALUES($1,$2,'pending') RETURNING *",
				[access.report.id, JSON.stringify(this.provider.configuration())]
			);
			await m.query(
				"UPDATE demand_planning_control SET last_created_at=clock_timestamp() WHERE id=1"
			);
			return { status: job.status, reused: false };
		});
	}
	async read(actor: string, month: string) {
		monthWindow(month);
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await this.repository.authorize(m, actor);
			const access = await planningAccess(m, month, this.repository, this.demand);
			const [job]: PlanningJob[] = await m.query(
				"SELECT * FROM demand_planning_jobs WHERE report_id=$1",
				[access.report.id]
			);
			const configChanged =
				!!job &&
				planningConfigHash(job.configuration) !== planningConfigHash(this.provider.configuration());
			const visible = access.usable && !configChanged;
			const status =
				access.report.status !== "succeeded"
					? "unavailable"
					: !access.context
						? "unavailable"
						: !visible
							? "withheld"
							: (job?.status ?? "not_requested");
			return {
				status,
				reportVersion: access.report.id,
				dataPeriod: month,
				generatedAt: visible ? (job?.generated_at ?? null) : null,
				stale: access.stale || configChanged,
				recommendations:
					visible && job?.status === "succeeded"
						? presentPlanning(job.output, access.context?.candidates ?? [])
						: [],
				errorCode: visible && job?.status === "failed" ? "analysis_unavailable" : null,
			};
		});
	}
	async claim(): Promise<PlanningJob | null> {
		return this.db.transaction(async (m) => {
			const locks: unknown[] = await m.query(
				"SELECT id FROM demand_planning_control WHERE id=1 FOR UPDATE SKIP LOCKED"
			);
			if (!locks.length) return null;
			await m.query(
				"UPDATE demand_planning_jobs SET status='failed',error_code='attempt_limit',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<=clock_timestamp() AND attempts>=3"
			);
			const active: unknown[] = await m.query(
				"SELECT id FROM demand_planning_jobs WHERE status='running' AND lease_until>clock_timestamp() LIMIT 1"
			);
			if (active.length) return null;
			const [job]: PlanningJob[] = await m.query(
				"SELECT j.*,r.month FROM demand_planning_jobs j JOIN demand_insight_reports r ON r.id=j.report_id WHERE j.attempts<3 AND ((j.status='pending' AND j.next_attempt_at<=clock_timestamp()) OR (j.status='running' AND j.lease_until<=clock_timestamp())) ORDER BY j.created_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1"
			);
			if (!job) return null;
			const token = randomUUID();
			await m.query(
				"UPDATE demand_planning_jobs SET status='running',attempts=attempts+1,lease_token=$2,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=$1",
				[job.id, token]
			);
			return { ...job, status: "running", attempts: job.attempts + 1, lease_token: token };
		});
	}
	async heartbeat(job: PlanningJob): Promise<boolean> {
		const rows: unknown[] = await this.db.query(
			"WITH renewed AS (UPDATE demand_planning_jobs SET lease_until=clock_timestamp()+interval '60 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>clock_timestamp() RETURNING id) SELECT id FROM renewed",
			[job.id, job.lease_token]
		);
		return rows.length > 0;
	}
	async finish(job: PlanningJob, output: PlanningChoice[] | null, error?: AnalysisProviderError) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			const [owned]: PlanningJob[] = await m.query(
				"SELECT * FROM demand_planning_jobs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>clock_timestamp() FOR UPDATE",
				[job.id, job.lease_token]
			);
			if (!owned) return false;
			const access = await planningAccess(m, job.month, this.repository, this.demand);
			const valid =
				access.usable &&
				planningConfigHash(job.configuration) === planningConfigHash(this.provider.configuration());
			const retry = valid && !!error?.retryable && owned.attempts < 3;
			const result =
				valid && output
					? validatePlanning({ recommendations: output }, access.context?.candidates ?? [])
					: null;
			const status = !valid ? "failed" : retry ? "pending" : result ? "succeeded" : "failed";
			const saved: unknown[] = await m.query(
				"WITH saved AS (UPDATE demand_planning_jobs SET status=$3,output=$4,error_code=$5,generated_at=CASE WHEN $3='succeeded' THEN clock_timestamp() ELSE generated_at END,lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+($6::int*interval '1 second') WHERE id=$1 AND lease_token=$2 AND lease_until>clock_timestamp() RETURNING id) SELECT id FROM saved",
				[
					job.id,
					job.lease_token,
					status,
					JSON.stringify(result ?? []),
					!valid ? "context_changed" : (error?.code ?? null),
					owned.attempts === 1 ? 5 : 30,
				]
			);
			return saved.length > 0;
		});
	}
	async processOne(): Promise<boolean> {
		const job = await this.claim();
		if (!job) return false;
		const abort = new AbortController();
		const timer = setInterval(() => {
			void this.heartbeat(job)
				.then((ok) => {
					if (!ok) abort.abort();
				})
				.catch(() => abort.abort());
		}, 20000);
		timer.unref();
		try {
			const access = await this.db.transaction((m) =>
				planningAccess(m, job.month, this.repository, this.demand)
			);
			if (!access.usable || !access.context) {
				await this.finish(job, null);
				return true;
			}
			const output = await this.provider.generate(
				job.month,
				access.context.candidates,
				job.configuration,
				abort.signal
			);
			await this.finish(job, output);
		} catch (error) {
			await this.finish(
				job,
				null,
				error instanceof AnalysisProviderError
					? error
					: new AnalysisProviderError(
							error instanceof Error && error.message === "invalid_output"
								? "invalid_output"
								: "provider_unavailable",
							!(error instanceof Error && error.message === "invalid_output")
						)
			);
		} finally {
			clearInterval(timer);
		}
		return true;
	}
}
