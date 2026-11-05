import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
	BASE_ELIGIBLE,
	BLOCKED,
	ELIGIBLE,
	SOURCE_FROM,
	SUPPRESSED,
} from "./review-analysis.queries";
import {
	type AnalysisBatch,
	type AnalysisConfig,
	BATCH_SIZE,
	type CoverageRow,
	type SourceReview,
} from "./review-analysis.types";

@Injectable()
export class ReviewAnalysisRepository {
	params(tripId: string, config: AnalysisConfig): string[] {
		return [tripId, config.provider, config.model, config.configVersion, config.promptVersion];
	}
	async source(m: EntityManager, id: string, lock = false): Promise<SourceReview | null> {
		// Match review writes' lock order: participation first, then review revision.
		if (lock) await m.query(`SELECT b.id ${SOURCE_FROM} WHERE r.id=$1 FOR SHARE OF b,m`, [id]);
		const rows: SourceReview[] = await m.query(
			`SELECT r.id,r.revision,r.comment,
   ${ELIGIBLE} AS eligible, ${BASE_ELIGIBLE} AS "participationEligible", ${SUPPRESSED} AS suppressed ${SOURCE_FROM} WHERE r.id=$1 ${lock ? "FOR SHARE OF r" : ""}`,
			[id]
		);
		return rows[0] ?? null;
	}
	async finishBatches(m: EntityManager): Promise<void> {
		await m.query(`UPDATE trip_review_analysis_batches b SET
   status=CASE WHEN NOT EXISTS(SELECT 1 FROM trip_review_analysis_batch_items bi WHERE bi.batch_id=b.id) THEN 'succeeded'
    WHEN NOT EXISTS(SELECT 1 FROM trip_review_analysis_batch_items bi JOIN trip_review_analysis_items i ON i.id=bi.item_id WHERE bi.batch_id=b.id AND i.status<>'succeeded') THEN 'succeeded'
    WHEN EXISTS(SELECT 1 FROM trip_review_analysis_batch_items bi JOIN trip_review_analysis_items i ON i.id=bi.item_id WHERE bi.batch_id=b.id AND i.status='succeeded') THEN 'partial' ELSE 'failed' END,
   completed_at=clock_timestamp()
   WHERE b.status IN ('pending','running') AND NOT EXISTS(
    SELECT 1 FROM trip_review_analysis_batch_items bi JOIN trip_review_analysis_items i ON i.id=bi.item_id
    WHERE bi.batch_id=b.id AND i.status IN ('pending','running'))`);
		await m.query(`UPDATE trip_review_analysis_batch_items bi SET terminal_status=i.status,terminal_error_code=i.error_code,end_attempt=i.attempts
         FROM trip_review_analysis_items i,trip_review_analysis_batches b WHERE bi.item_id=i.id AND bi.batch_id=b.id
         AND bi.terminal_status IS NULL AND b.status NOT IN ('pending','running')`);
	}
	async remaining(m: EntityManager, tripId: string, config: AnalysisConfig): Promise<number> {
		const [row]: { count: number }[] = await m.query(
			`SELECT count(*)::int AS count ${SOURCE_FROM}
   WHERE r.trip_id=$1 AND ${ELIGIBLE} AND NOT EXISTS(
    SELECT 1 FROM trip_review_analysis_items i WHERE i.review_id=r.id AND i.source_revision=r.revision
     AND i.provider=$2 AND i.model=$3 AND i.config_version=$4 AND i.prompt_version=$5 AND NOT (i.status='skipped' AND i.attempts<3))`,
			this.params(tripId, config)
		);
		return row.count;
	}
	async enqueue(
		m: EntityManager,
		actor: string,
		tripId: string,
		config: AnalysisConfig
	): Promise<AnalysisBatch> {
		const id = randomUUID();
		const [batch]: AnalysisBatch[] = await m.query(
			`INSERT INTO trip_review_analysis_batches
   (id,trip_id,requester_id,provider,model,config_version,prompt_version,status) VALUES ($6,$1,$7,$2,$3,$4,$5,'pending') RETURNING *`,
			[...this.params(tripId, config), id, actor]
		);
		const candidates: { id: string; revision: number }[] = await m.query(
			`SELECT r.id,r.revision ${SOURCE_FROM}
   WHERE r.trip_id=$1 AND ${ELIGIBLE} AND NOT EXISTS(SELECT 1 FROM trip_review_analysis_items i
    WHERE i.review_id=r.id AND i.source_revision=r.revision AND i.provider=$2 AND i.model=$3 AND i.config_version=$4 AND i.prompt_version=$5 AND NOT (i.status='skipped' AND i.attempts<3))
   ORDER BY r.created_at,r.id LIMIT ${BATCH_SIZE}`,
			this.params(tripId, config)
		);
		for (const source of candidates) {
			const itemId = randomUUID();
			await m.query(
				`INSERT INTO trip_review_analysis_items(id,review_id,source_revision,provider,model,config_version,prompt_version,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT (review_id,source_revision,provider,model,config_version,prompt_version) DO UPDATE SET status='pending',error_code=NULL,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() WHERE trip_review_analysis_items.status='skipped' AND trip_review_analysis_items.attempts<3`,
				[
					itemId,
					source.id,
					source.revision,
					config.provider,
					config.model,
					config.configVersion,
					config.promptVersion,
				]
			);
			await m.query(
				`INSERT INTO trip_review_analysis_batch_items(batch_id,item_id,start_attempt) SELECT $1,id,attempts FROM trip_review_analysis_items
    WHERE review_id=$2 AND source_revision=$3 AND provider=$4 AND model=$5 AND config_version=$6 AND prompt_version=$7 ON CONFLICT DO NOTHING`,
				[
					id,
					source.id,
					source.revision,
					config.provider,
					config.model,
					config.configVersion,
					config.promptVersion,
				]
			);
		}
		await this.finishBatches(m);
		const [result]: AnalysisBatch[] = await m.query(
			"SELECT * FROM trip_review_analysis_batches WHERE id=$1",
			[id]
		);
		return result ?? batch;
	}
	async coverageRows(
		m: EntityManager,
		tripId: string,
		config: AnalysisConfig
	): Promise<CoverageRow[]> {
		return m.query(
			`SELECT r.id AS "reviewId",r.revision AS "sourceRevision", ${ELIGIBLE} AS eligible,
   ${BASE_ELIGIBLE} AS "participationEligible", ${BLOCKED} AS blocked, ${SUPPRESSED} AS suppressed,
   i.id AS "analysisId",i.status,i.sentiment,i.topics,i.summary,i.confidence,i.actual_model AS "actualModel",
   i.updated_at AS "analyzedAt", EXISTS(SELECT 1 FROM trip_review_analysis_items old WHERE old.review_id=r.id AND old.status='succeeded') AS "hasHistory",
   EXISTS(SELECT 1 FROM trip_review_analysis_items old WHERE old.review_id=r.id AND old.status='succeeded' AND old.source_revision=r.revision) AS "hasRevisionHistory"
   ${SOURCE_FROM} LEFT JOIN trip_review_analysis_items i ON i.review_id=r.id AND i.source_revision=r.revision
    AND i.provider=$2 AND i.model=$3 AND i.config_version=$4 AND i.prompt_version=$5
   WHERE r.trip_id=$1 AND r.target='trip' ORDER BY r.created_at,r.id`,
			this.params(tripId, config)
		);
	}
}
