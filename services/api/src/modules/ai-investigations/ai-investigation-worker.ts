import { createHash, randomUUID } from "node:crypto";
import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource, type EntityManager } from "typeorm";
import {
	AiInvestigationAnalyzer,
	citationMismatchIssue,
	groupKey,
	unavailableIssue,
} from "./ai-investigation-analyzer";
import { unmatchedCitation } from "./ai-investigation-evidence";
import {
	CasePriority,
	type InvestigationReport,
	type Job,
	Processing,
	type Snapshot,
} from "./ai-investigation.types";

const MAX_ATTEMPTS = 3;
const POLL_MS = 1500;
const CLEANUP_INTERVAL_MS = 60 * 60_000;

type WorkSnapshot = {
	id: string;
	latest_job_id: string;
	snapshot: Snapshot | null;
};

@Injectable()
export class AiInvestigationWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(AiInvestigationWorker.name);
	private poll?: NodeJS.Timeout;
	private cleanup?: NodeJS.Timeout;
	private active?: Promise<boolean>;
	private activeCleanup?: Promise<void>;

	constructor(
		@Inject(DataSource) private readonly db: DataSource,
		@Inject(AiInvestigationAnalyzer) private readonly analyzer: AiInvestigationAnalyzer,
		@Inject(ConfigService) private readonly config: ConfigService
	) {}

	onModuleInit() {
		if (this.config.get<string>("NODE_ENV") === "test") return;
		this.poll = setInterval(() => {
			if (this.active) return;
			this.active = this.processNext()
				.catch(() => {
					this.logger.warn("AI_INVESTIGATION_WORKER_FAILED");
					return false;
				})
				.finally(() => {
					this.active = undefined;
				});
		}, POLL_MS).unref();
		this.cleanup = setInterval(() => {
			if (this.activeCleanup) return;
			this.activeCleanup = this.purgeClosedEvidence()
				.catch(() => {
					this.logger.warn("AI_INVESTIGATION_CLEANUP_FAILED");
				})
				.finally(() => {
					this.activeCleanup = undefined;
				});
		}, CLEANUP_INTERVAL_MS).unref();
	}

	async onModuleDestroy() {
		clearInterval(this.poll);
		clearInterval(this.cleanup);
		await Promise.all([this.active, this.activeCleanup]);
	}

	async processNext(): Promise<boolean> {
		const [job]: Job[] = await this.db.query(
			`WITH claimed AS (
			 UPDATE ai_investigation_jobs SET status='PROCESSING',
			 attempts=attempts+1, lease_token=$1, lease_until=clock_timestamp()+interval '30 seconds'
			 WHERE id=(SELECT id FROM ai_investigation_jobs
			 WHERE ($2 OR priority=2) AND ((status='PENDING' AND available_at<=clock_timestamp())
			    OR (status='PROCESSING' AND lease_until<=clock_timestamp()))
			 ORDER BY priority,available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *
			) SELECT * FROM claimed`,
			[randomUUID(), this.config.get<string>("AI_INVESTIGATION_PROVIDER_ENABLED") === "true"]
		);
		if (!job) return false;
		if (job.priority === CasePriority.USEFUL) {
			await this.finish(job);
			return true;
		}
		const [work]: Array<WorkSnapshot & { report_reason: string | null }> = await this.db.query(
			"SELECT id,latest_job_id,snapshot,report_reason FROM ai_investigation_cases WHERE feedback_id=$1",
			[job.feedback_id]
		);
		let report: InvestigationReport | undefined;
		if (work?.snapshot && work.latest_job_id === job.id && job.attempts <= MAX_ATTEMPTS) {
			try {
				report = await this.analyzer.analyze(job, work.snapshot, work.report_reason);
			} catch {
				// A bounded technical retry is scheduled below. Evidence is kept in the case.
			}
		}
		await this.finish(job, report);
		return true;
	}

	private async finish(job: Job, report?: InvestigationReport) {
		await this.db.transaction(async (manager) => {
			const [owned]: Job[] = await manager.query(
				`SELECT id FROM ai_investigation_jobs WHERE id=$1 AND lease_token=$2
				 AND status='PROCESSING' AND lease_until>clock_timestamp() FOR UPDATE`,
				[job.id, job.lease_token]
			);
			if (!owned) return;
			if (job.priority === CasePriority.USEFUL) {
				await manager.query(
					`INSERT INTO ai_feedback_quality_signals AS s(day,useful_only_changes)
				 SELECT (created_at AT TIME ZONE 'UTC')::date,1 FROM ai_investigation_jobs WHERE id=$1
				 ON CONFLICT(day) DO UPDATE SET useful_only_changes=s.useful_only_changes+1`,
					[job.id]
				);
				await manager.query("DELETE FROM ai_investigation_jobs WHERE id=$1", [job.id]);
				return;
			}
			const [work]: WorkSnapshot[] = await manager.query(
				"SELECT id,latest_job_id,snapshot FROM ai_investigation_cases WHERE feedback_id=$1 FOR UPDATE",
				[job.feedback_id]
			);
			if (!work?.snapshot || work.latest_job_id !== job.id) {
				await this.setJobStatus(manager, job, Processing.SUPERSEDED);
				return;
			}
			if (report) {
				await this.saveReport(manager, work.id, work.snapshot, report);
				await this.setJobStatus(manager, job, Processing.COMPLETE);
				return;
			}
			if (job.attempts >= MAX_ATTEMPTS) {
				const issues = unmatchedCitation(work.snapshot)
					? [citationMismatchIssue(), unavailableIssue()]
					: [unavailableIssue()];
				await this.saveReport(manager, work.id, work.snapshot, {
					issues,
					model: null,
					provider: null,
					consideredEvidence: [],
				});
				await this.setJobStatus(manager, job, Processing.FAILED);
				return;
			}
			await this.setJobStatus(manager, job, Processing.PENDING, 30 * 2 ** (job.attempts - 1));
		});
	}

	private async setJobStatus(
		manager: EntityManager,
		job: Job,
		status: Processing,
		retrySeconds = 0
	) {
		await manager.query(
			`UPDATE ai_investigation_jobs SET status=$2, lease_token=NULL,lease_until=NULL,
			 available_at=clock_timestamp()+$3::int*interval '1 second' WHERE id=$1`,
			[job.id, status, retrySeconds]
		);
	}

	private async saveReport(
		manager: EntityManager,
		caseId: string,
		snapshot: Snapshot,
		report: InvestigationReport
	) {
		await manager.query(
			"UPDATE ai_investigation_cases SET report=$2::jsonb,version=version+1 WHERE id=$1",
			[caseId, JSON.stringify(report)]
		);
		await manager.query("DELETE FROM ai_investigation_members WHERE case_id=$1", [caseId]);
		// A common lock order lets workers replace membership concurrently without deadlocking.
		const memberships = report.issues
			.map(({ classification }, index) => ({
				classification,
				index,
				key: createHash("sha256")
					.update(groupKey(caseId, index, classification, snapshot))
					.digest("hex"),
			}))
			.sort((a, b) => a.key.localeCompare(b.key));
		for (const { key, classification, index } of memberships) {
			const [group]: Array<{ id: string }> = await manager.query(
				`INSERT INTO ai_investigation_groups(mechanism_key,classification) VALUES($1,$2)
				 ON CONFLICT(mechanism_key) DO UPDATE SET mechanism_key=excluded.mechanism_key RETURNING id`,
				[key, classification]
			);
			await manager.query(
				"INSERT INTO ai_investigation_members(case_id,group_id,issue_index) VALUES($1,$2,$3)",
				[caseId, group.id, index]
			);
		}
	}

	async purgeClosedEvidence() {
		// Post-disposition cleanup is opt-in after approval. Original answer/feedback expiry is independent.
		const configured = this.config.get<string>("AI_INVESTIGATION_CLOSED_RETENTION_DAYS");
		if (!configured || !/^[1-9]\d{0,3}$/.test(configured)) return;
		await this.db.query(
			`UPDATE ai_investigation_cases SET snapshot=NULL,report=NULL,report_reason=NULL,evidence_removed_at=clock_timestamp()
			 WHERE id IN (SELECT id FROM ai_investigation_cases WHERE closed_at IS NOT NULL
			 AND NOT retention_hold AND evidence_removed_at IS NULL
			 AND closed_at<=clock_timestamp()-$1::int*interval '1 day'
			 ORDER BY closed_at LIMIT 100 FOR UPDATE SKIP LOCKED)`,
			[Number(configured)]
		);
	}
}
