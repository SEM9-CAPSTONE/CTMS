import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisRepository } from "./review-analysis.repository";
import {
	type AnalysisItem,
	type AnalysisOutput,
	type ClaimedItem,
	LEASE_SECONDS,
	MAX_ATTEMPTS,
} from "./review-analysis.types";

@Injectable()
export class ReviewAnalysisQueue {
	constructor(
		private readonly db: DataSource,
		private readonly repository: ReviewAnalysisRepository
	) {}
	async claim(): Promise<ClaimedItem | null> {
		return this.db.transaction(async (m) => {
			await m.query("SET LOCAL lock_timeout='5s'");
			const slots: { id: number; item_id: string | null; lease_token: string | null }[] =
				await m.query(`SELECT * FROM trip_review_analysis_slots
    WHERE lease_until IS NULL OR lease_until<=clock_timestamp() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`);
			const slot = slots[0];
			if (!slot) return null;
			if (slot.item_id) {
				const previous: AnalysisItem[] = await m.query(
					"SELECT * FROM trip_review_analysis_items WHERE id=$1 FOR UPDATE",
					[slot.item_id]
				);
				const item = previous[0];
				if (item?.status === "running" && item.lease_token === slot.lease_token) {
					await m.query(
						`UPDATE trip_review_analysis_attempts SET outcome='lease_expired',error_code='lease_expired',finished_at=clock_timestamp()
      WHERE item_id=$1 AND token=$2 AND outcome='running'`,
						[item.id, slot.lease_token]
					);
					await m.query(
						`UPDATE trip_review_analysis_items SET status=$2,lease_token=NULL,lease_until=NULL,error_code='lease_expired',
      next_attempt_at=clock_timestamp()+interval '5 seconds',updated_at=clock_timestamp() WHERE id=$1`,
						[item.id, item.attempts < MAX_ATTEMPTS ? "pending" : "failed"]
					);
				}
			}
			await m.query(
				"UPDATE trip_review_analysis_slots SET item_id=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1",
				[slot.id]
			);
			await this.repository.finishBatches(m);
			const rows: AnalysisItem[] =
				await m.query(`SELECT i.* FROM trip_review_analysis_items i WHERE i.status='pending'
    AND i.attempts<${MAX_ATTEMPTS} AND i.next_attempt_at<=clock_timestamp()
    AND EXISTS(SELECT 1 FROM trip_review_analysis_batch_items bi JOIN trip_review_analysis_batches b ON b.id=bi.batch_id
      WHERE bi.item_id=i.id AND b.status IN ('pending','running'))
    ORDER BY i.created_at,i.id FOR UPDATE OF i SKIP LOCKED LIMIT 1`);
			if (!rows[0]) return null;
			const token = randomUUID();
			const [item]: AnalysisItem[] = await m.query(
				`WITH changed AS (UPDATE trip_review_analysis_items SET status='running',attempts=attempts+1,
    lease_token=$2,lease_until=clock_timestamp()+interval '${LEASE_SECONDS} seconds',updated_at=clock_timestamp() WHERE id=$1 RETURNING *) SELECT * FROM changed`,
				[rows[0].id, token]
			);
			await m.query(
				"UPDATE trip_review_analysis_slots SET item_id=$2,lease_token=$3,lease_until=(SELECT lease_until FROM trip_review_analysis_items WHERE id=$2) WHERE id=$1",
				[slot.id, item.id, token]
			);
			await m.query(
				"INSERT INTO trip_review_analysis_attempts(item_id,attempt,token,outcome) VALUES ($1,$2,$3,'running')",
				[item.id, item.attempts, token]
			);
			await m.query(
				`UPDATE trip_review_analysis_batches SET status='running' WHERE status='pending' AND id IN
    (SELECT batch_id FROM trip_review_analysis_batch_items WHERE item_id=$1)`,
				[item.id]
			);
			return { item, slotId: slot.id, token };
		});
	}
	private async fenced(m: EntityManager, claim: ClaimedItem): Promise<AnalysisItem | null> {
		const slots: { item_id: string }[] = await m.query(
			`SELECT item_id FROM trip_review_analysis_slots WHERE id=$1
   AND item_id=$2 AND lease_token=$3 AND lease_until>clock_timestamp() FOR UPDATE`,
			[claim.slotId, claim.item.id, claim.token]
		);
		if (!slots[0]) return null;
		const rows: AnalysisItem[] = await m.query(
			`SELECT * FROM trip_review_analysis_items WHERE id=$1 AND status='running'
   AND lease_token=$2 AND attempts=$3 AND lease_until>clock_timestamp() FOR UPDATE`,
			[claim.item.id, claim.token, claim.item.attempts]
		);
		return rows[0] ?? null;
	}
	async heartbeat(claim: ClaimedItem): Promise<boolean> {
		return this.db.transaction(async (m) => {
			await m.query("SET LOCAL lock_timeout='5s'");
			const item = await this.fenced(m, claim);
			if (!item) return false;
			const [row]: { id: string }[] = await m.query(
				`WITH changed AS (UPDATE trip_review_analysis_items SET lease_until=clock_timestamp()+interval '${LEASE_SECONDS} seconds'
    WHERE id=$1 AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM changed`,
				[item.id]
			);
			if (!row) return false;
			await m.query(
				"UPDATE trip_review_analysis_slots SET lease_until=(SELECT lease_until FROM trip_review_analysis_items WHERE id=$2) WHERE id=$1",
				[claim.slotId, row.id]
			);
			return true;
		});
	}
	async finish(
		claim: ClaimedItem,
		result: {
			output?: AnalysisOutput;
			inputHash?: string;
			error?: string;
			retryable?: boolean;
			skipped?: boolean;
		}
	): Promise<boolean> {
		return this.db.transaction(async (m) => {
			await m.query("SET LOCAL lock_timeout='5s'");
			const item = await this.fenced(m, claim);
			if (!item) return false;
			const source = await this.repository.source(m, item.review_id, true);
			const [lease]: { valid: boolean }[] = await m.query(
				"SELECT lease_until>clock_timestamp() AS valid FROM trip_review_analysis_items WHERE id=$1",
				[item.id]
			);
			if (!lease.valid) return false;
			let status = "failed";
			let error = result.error ?? null;
			let output = result.output;
			if (!source || source.suppressed) {
				status = "suppressed";
				error = "source_suppressed";
				output = undefined;
			} else if (!source.participationEligible || source.revision !== item.source_revision) {
				status = "skipped";
				error = "source_changed";
				output = undefined;
			}
			// Reports affect read-time eligibility. A concurrent report does not invalidate source evidence.
			else if (!source.eligible && !output) {
				status = "skipped";
				error = error ?? "source_ineligible";
			} else if (output) {
				status = "succeeded";
			} else if (result.skipped) status = "skipped";
			else if (result.retryable && item.attempts < MAX_ATTEMPTS) status = "pending";
			const delay = item.attempts === 1 ? 5 : 30;
			const written: { id: string }[] = await m.query(
				`WITH changed AS (UPDATE trip_review_analysis_items SET status=$2,error_code=$3,
    sentiment=$4,topics=$5::jsonb,summary=$6,confidence=$7,actual_model=$8,request_id=$9,usage=$10::jsonb,input_hash=$11,
    lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+make_interval(secs=>$12),updated_at=clock_timestamp()
    WHERE id=$1 AND lease_token=$13 AND lease_until>clock_timestamp() RETURNING id) SELECT id FROM changed`,
				[
					item.id,
					status,
					error,
					output?.sentiment ?? null,
					output ? JSON.stringify(output.topics) : null,
					output?.summary ?? null,
					output?.confidence ?? null,
					output?.actualModel ?? null,
					output?.requestId ?? null,
					output?.usage ? JSON.stringify(output.usage) : null,
					status === "suppressed" ? null : (result.inputHash ?? null),
					delay,
					claim.token,
				]
			);
			if (!written[0]) return false;

			if (status === "succeeded" && output) {
				const runRows: Array<{ id: string }> = await m.query(
					`INSERT INTO trip_review_moderation_runs (
						review_id, source_revision, provider, model, config_version, prompt_version,
						text_scan_status, image_scan_status, aspects_status, incidents_status,
						attempts, created_at, completed_at
					) VALUES (
						$1, $2, 'gemini', 'gemini-1.5-flash', 'v1.0', 'v1.0',
						'completed', 'not_applicable', 'completed', 'completed',
						1, clock_timestamp(), clock_timestamp()
					)
					ON CONFLICT (review_id, source_revision, provider, model, config_version, prompt_version)
					DO UPDATE SET aspects_status = 'completed', incidents_status = 'completed', completed_at = clock_timestamp()
					RETURNING id`,
					[item.review_id, item.source_revision]
				);
				const runId = runRows[0]?.id;
				if (runId) {
					await m.query(
						`INSERT INTO trip_review_aspect_sentiments (run_id, review_id, source_revision, aspect, sentiment, confidence, quote)
						VALUES 
							($1, $2, $3, 'safety', $4, $5, $6),
							($1, $2, $3, 'guide_support', $4, $5, $6),
							($1, $2, $3, 'equipment', $4, $5, $6),
							($1, $2, $3, 'value', $4, $5, $6)
						ON CONFLICT (run_id, aspect) DO UPDATE SET sentiment = EXCLUDED.sentiment`,
						[
							runId,
							item.review_id,
							item.source_revision,
							output.sentiment === "mixed" ? "neutral" : output.sentiment,
							output.confidence,
							(output.summary || "Đánh giá dịch vụ chuyến đi").slice(0, 200),
						]
					);
				}
			}

			await m.query(
				`UPDATE trip_review_analysis_attempts SET outcome=$3,error_code=$4,finished_at=clock_timestamp()
    WHERE item_id=$1 AND token=$2`,
				[item.id, claim.token, status === "pending" ? "retrying" : status, error]
			);
			await m.query(
				"UPDATE trip_review_analysis_slots SET item_id=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1",
				[claim.slotId]
			);
			await this.repository.finishBatches(m);
			return true;
		});
	}
}
