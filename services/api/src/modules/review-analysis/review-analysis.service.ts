import { ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { authorizeAnalysis } from "./review-analysis.access";
import type { AnalysisInsightsQueryDto, AnalysisPageDto } from "./review-analysis.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisProvider } from "./review-analysis.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisRepository } from "./review-analysis.repository";
import {
	type AnalysisBatch,
	type AnalysisItem,
	type CoverageRow,
	type ItemStatus,
	SENTIMENTS,
	TOPICS,
} from "./review-analysis.types";

@Injectable()
export class ReviewAnalysisService {
	constructor(
		private readonly db: DataSource,
		private readonly repository: ReviewAnalysisRepository,
		private readonly provider: ReviewAnalysisProvider
	) {}
	private batchResponse(batch: AnalysisBatch) {
		return {
			id: batch.id,
			tripId: batch.trip_id,
			status: batch.status,
			provider: batch.provider,
			model: batch.model,
			configVersion: batch.config_version,
			promptVersion: batch.prompt_version,
			createdAt: batch.created_at,
			completedAt: batch.completed_at,
		};
	}
	async trips(actorId: string, page: AnalysisPageDto) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await authorizeAnalysis(m, actorId);
			const filter = `WHERE t.host_id=$1 OR EXISTS(SELECT 1 FROM users u WHERE u.id=$1 AND
 (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='admin') OR (u.role='admin' AND NOT EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id))))`;
			const [count]: { total: number }[] = await m.query(
				`SELECT count(*)::int AS total FROM trips t ${filter}`,
				[actorId]
			);
			const items: { id: string; title: string; status: string }[] = await m.query(
				`SELECT t.id,t.title,t.status FROM trips t ${filter} ORDER BY t.updated_at DESC,t.id LIMIT $2 OFFSET $3`,
				[actorId, page.limit, (page.page - 1) * page.limit]
			);
			return {
				items,
				pagination: {
					page: page.page,
					totalPages: Math.ceil(count.total / page.limit),
					total: count.total,
				},
			};
		});
	}
	async sourceReview(actorId: string, tripId: string, reviewId: string, revision: string) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await authorizeAnalysis(m, actorId, tripId);
			const rows = await this.repository.coverageRows(m, tripId, this.provider.configuration());
			const row = rows.find((r) => r.reviewId === reviewId);
			if (!row || !/^[1-9]\d{0,8}$/.test(revision))
				throw new NotFoundException("Source revision not found");
			if (!row.eligible) throw new ForbiddenException("Source review unavailable for analysis");
			const [source]: {
				revision: number;
				rating: number;
				comment: string | null;
				createdAt: Date;
			}[] = await m.query(
				`SELECT revision,rating,comment,recorded_at AS "createdAt" FROM trip_review_revisions WHERE review_id=$1 AND revision=$2`,
				[reviewId, Number(revision)]
			);
			if (!source) throw new NotFoundException("Source revision not found");
			return { reviewId, ...source, currentRevision: row.sourceRevision };
		});
	}
	async create(actorId: string, tripId: string) {
		const config = this.provider.configuration();
		return this.db.transaction(async (m) => {
			await authorizeAnalysis(m, actorId, tripId);
			await m.query(
				"INSERT INTO trip_review_analysis_controls(trip_id) VALUES ($1) ON CONFLICT DO NOTHING",
				[tripId]
			);
			const [control]: { last_batch_at: Date | null }[] = await m.query(
				"SELECT * FROM trip_review_analysis_controls WHERE trip_id=$1 FOR UPDATE",
				[tripId]
			);
			const active: AnalysisBatch[] = await m.query(
				"SELECT * FROM trip_review_analysis_batches WHERE trip_id=$1 AND status IN ('pending','running')",
				[tripId]
			);
			if (active[0]) {
				const remainingCount = await this.repository.remaining(m, tripId, config);
				return {
					batch: this.batchResponse(active[0]),
					reused: true,
					remainingCount,
					hasMore: remainingCount > 0,
				};
			}
			const [time]: { now: Date }[] = await m.query("SELECT clock_timestamp() AS now");
			const wait = control.last_batch_at
				? 60 - Math.floor((time.now.getTime() - control.last_batch_at.getTime()) / 1000)
				: 0;
			if (wait > 0)
				throw new HttpException(
					{ statusCode: 429, message: "Trip analysis cooldown", retryAfterSeconds: wait },
					429
				);
			await m.query(
				"UPDATE trip_review_analysis_controls SET last_batch_at=clock_timestamp() WHERE trip_id=$1",
				[tripId]
			);
			const batch = await this.repository.enqueue(m, actorId, tripId, config);
			await this.audit(m, actorId, "trip_review_analysis.batch_created", batch.id);
			const remainingCount = await this.repository.remaining(m, tripId, config);
			return {
				batch: this.batchResponse(batch),
				reused: false,
				remainingCount,
				hasMore: remainingCount > 0,
			};
		});
	}
	async batch(actorId: string, tripId: string, batchId: string) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await authorizeAnalysis(m, actorId, tripId);
			const batches: AnalysisBatch[] = await m.query(
				"SELECT * FROM trip_review_analysis_batches WHERE id=$1 AND trip_id=$2",
				[batchId, tripId]
			);
			if (!batches[0]) throw new NotFoundException("Analysis batch not found");
			const items: (AnalysisItem & {
				terminal_status: ItemStatus | null;
				terminal_error_code: string | null;
				start_attempt: number;
				end_attempt: number | null;
			})[] = await m.query(
				"SELECT i.*,bi.terminal_status,bi.terminal_error_code,bi.start_attempt,bi.end_attempt FROM trip_review_analysis_items i JOIN trip_review_analysis_batch_items bi ON bi.item_id=i.id WHERE bi.batch_id=$1 ORDER BY i.created_at,i.id",
				[batchId]
			);
			const coverage = await this.repository.coverageRows(m, tripId, this.provider.configuration());
			const current = new Set(
				coverage
					.filter((row) => row.eligible && row.status === "succeeded")
					.map((row) => row.analysisId)
			);
			const reasonFor = (item: AnalysisItem) => {
				const source = coverage.find((row) => row.reviewId === item.review_id);
				if (!source || source.suppressed) return "source_unavailable";
				if (source.blocked) return "eligibility_restricted";
				if (source.sourceRevision !== item.source_revision) return "review_changed";
				const config = this.provider.configuration();
				if (
					item.provider !== config.provider ||
					item.model !== config.model ||
					item.config_version !== config.configVersion ||
					item.prompt_version !== config.promptVersion
				)
					return "configuration_changed";
				return source.eligible ? null : "source_unavailable";
			};
			const progress = {
				total: items.length,
				pending: 0,
				running: 0,
				succeeded: 0,
				failed: 0,
				skipped: 0,
				suppressed: 0,
			};
			const statusOf = (item: (typeof items)[number]) =>
				item.status === "suppressed" ? "suppressed" : (item.terminal_status ?? item.status);
			for (const item of items) progress[statusOf(item)]++;
			const attempts: {
				item_id: string;
				attempt: number;
				started_at: Date;
				finished_at: Date | null;
				outcome: string;
				error_code: string | null;
			}[] = await m.query(
				"SELECT a.item_id,a.attempt,a.started_at,a.finished_at,a.outcome,a.error_code FROM trip_review_analysis_attempts a JOIN trip_review_analysis_batch_items bi ON bi.item_id=a.item_id WHERE bi.batch_id=$1 ORDER BY a.attempt",
				[batchId]
			);
			const remainingCount = await this.repository.remaining(
				m,
				tripId,
				this.provider.configuration()
			);
			return {
				batch: this.batchResponse(batches[0]),
				progress,
				items: items.map((item) => ({
					id: item.id,
					reviewId: item.review_id,
					sourceRevision: item.source_revision,
					status: statusOf(item),
					attempts: (item.end_attempt ?? item.attempts) - item.start_attempt,
					errorCode: item.terminal_status ? item.terminal_error_code : item.error_code,
					current: statusOf(item) === "succeeded" && current.has(item.id),
					freshnessReason: reasonFor(item),
					history: attempts
						.filter(
							(a) =>
								a.item_id === item.id &&
								a.attempt > item.start_attempt &&
								a.attempt <= (item.end_attempt ?? item.attempts)
						)
						.map((a) => ({
							attempt: a.attempt,
							startedAt: a.started_at,
							finishedAt: a.finished_at,
							outcome: a.outcome,
							errorCode: a.error_code,
						})),
					analysis:
						statusOf(item) === "succeeded" && item.status === "succeeded"
							? {
									sentiment: item.sentiment,
									topics: item.topics,
									summary: item.summary,
									confidence: item.confidence,
									actualModel: item.actual_model,
								}
							: null,
				})),
				remainingCount,
				hasMore: remainingCount > 0,
			};
		});
	}
	async insights(actorId: string, tripId: string, page: AnalysisInsightsQueryDto) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			await authorizeAnalysis(m, actorId, tripId);
			const rows = await this.repository.coverageRows(m, tripId, this.provider.configuration());
			const coverage = {
				eligible: 0,
				analyzed: 0,
				pending: 0,
				failed: 0,
				stale: 0,
				unprocessed: 0,
				excluded: 0,
				ratio: 0,
			};
			const sentimentCounts = Object.fromEntries(SENTIMENTS.map((key) => [key, 0])) as Record<
				(typeof SENTIMENTS)[number],
				number
			>;
			const topics = Object.fromEntries(TOPICS.map((key) => [key, 0])) as Record<
				(typeof TOPICS)[number],
				number
			>;
			const current: CoverageRow[] = [];
			for (const row of rows) {
				if (!row.eligible) {
					coverage.excluded++;
					continue;
				}
				coverage.eligible++;
				if (row.status === "succeeded") {
					coverage.analyzed++;
					current.push(row);
					if (row.sentiment) sentimentCounts[row.sentiment]++;
					for (const topic of row.topics ?? []) topics[topic]++;
				} else if (row.status === "pending" || row.status === "running") coverage.pending++;
				else if (row.status === "failed" || row.status === "skipped" || row.status === "suppressed")
					coverage.failed++;
				else if (row.hasHistory) coverage.stale++;
				else coverage.unprocessed++;
			}
			coverage.ratio = coverage.eligible ? coverage.analyzed / coverage.eligible : 0;
			const filtered = page.sentiment
				? current.filter((row) => row.sentiment === page.sentiment)
				: current;
			return {
				tripId,
				...(await this.readExecutionContext(m, tripId)),
				configuration: this.provider.configuration(),
				coverage,
				freshness: {
					reviewChanged: rows.filter(
						(r) => r.eligible && !r.status && r.hasHistory && !r.hasRevisionHistory
					).length,
					configurationChanged: rows.filter((r) => r.eligible && !r.status && r.hasRevisionHistory)
						.length,
					restricted: rows.filter((r) => r.blocked).length,
				},
				sentimentCounts,
				topics: TOPICS.filter((topic) => topics[topic] > 0).map((topic) => ({
					topic,
					count: topics[topic],
					denominator: coverage.analyzed,
				})),
				items: filtered.slice((page.page - 1) * page.limit, page.page * page.limit).map((row) => ({
					id: row.analysisId,
					reviewId: row.reviewId,
					sourceRevision: row.sourceRevision,
					sentiment: row.sentiment,
					topics: row.topics,
					summary: row.summary,
					confidence: row.confidence,
					actualModel: row.actualModel,
					analyzedAt: row.analyzedAt,
				})),
				pagination: {
					page: page.page,
					limit: page.limit,
					total: filtered.length,
					totalPages: Math.ceil(filtered.length / page.limit),
				},
			};
		});
	}
	private async readExecutionContext(m: EntityManager, tripId: string) {
		const [batch]: AnalysisBatch[] = await m.query(
			"SELECT * FROM trip_review_analysis_batches WHERE trip_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
			[tripId]
		);
		const [control]: { retryAfterSeconds: number }[] = await m.query(
			`SELECT GREATEST(0,ceil(60-extract(epoch FROM (clock_timestamp()-last_batch_at))))::int AS "retryAfterSeconds" FROM trip_review_analysis_controls WHERE trip_id=$1`,
			[tripId]
		);
		return {
			latestBatch: batch ? this.batchResponse(batch) : null,
			retryAfterSeconds: control?.retryAfterSeconds ?? 0,
		};
	}
	async redact(actorId: string, reviewId: string) {
		return this.db.transaction(async (m) => {
			await authorizeAnalysis(m, actorId, undefined, true);
			const rows: { trip_id: string }[] = await m.query(
				"SELECT trip_id FROM trip_reviews WHERE id=$1",
				[reviewId]
			);
			if (!rows[0]) throw new NotFoundException("Review not found");
			await m.query(
				"INSERT INTO trip_review_analysis_controls(trip_id) VALUES ($1) ON CONFLICT DO NOTHING",
				[rows[0].trip_id]
			);
			await m.query(
				"SELECT trip_id FROM trip_review_analysis_controls WHERE trip_id=$1 FOR UPDATE",
				[rows[0].trip_id]
			);
			// Same lock order as claim/completion. Lock slots before items to fence in-flight workers.
			await m.query("SELECT id FROM trip_review_analysis_slots ORDER BY id FOR UPDATE");
			await m.query(
				"INSERT INTO trip_review_analysis_suppressions(review_id) VALUES ($1) ON CONFLICT DO NOTHING",
				[reviewId]
			);
			await m.query(
				`UPDATE trip_review_analysis_attempts SET outcome=CASE WHEN outcome='running' THEN 'suppressed' ELSE outcome END,
    finished_at=COALESCE(finished_at,clock_timestamp()),error_code=NULL WHERE item_id IN(SELECT id FROM trip_review_analysis_items WHERE review_id=$1)`,
				[reviewId]
			);
			await m.query(
				`UPDATE trip_review_analysis_slots SET item_id=NULL,lease_token=NULL,lease_until=NULL
    WHERE item_id IN(SELECT id FROM trip_review_analysis_items WHERE review_id=$1)`,
				[reviewId]
			);
			await m.query(
				`UPDATE trip_review_analysis_items SET status='suppressed',sentiment=NULL,topics=NULL,summary=NULL,confidence=NULL,
    actual_model=NULL,request_id=NULL,usage=NULL,input_hash=NULL,error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE review_id=$1`,
				[reviewId]
			);
			await this.repository.finishBatches(m);
			await this.audit(m, actorId, "trip_review_analysis.redacted", reviewId, "privacy_erasure");
			return { reviewId, suppressed: true };
		});
	}
	private async audit(
		m: EntityManager,
		actorId: string,
		action: string,
		targetId: string,
		reason: string | null = null
	): Promise<void> {
		await m.getRepository(AuditLog).save({
			actorId,
			action,
			targetType: "trip_review_analysis",
			targetId,
			before: null,
			after: null,
			reason,
		});
	}
}
