import { randomUUID } from "node:crypto";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { maskPii } from "./pii-masker";
import {
	MODERATION_LEASE_DURATION_MS,
	MODERATION_MAX_ATTEMPTS,
} from "./trip-review-moderation.constants";
import {
	ModerationProviderError,
	// biome-ignore lint/style/useImportType: Nest injection
	TripReviewModerationProvider,
} from "./trip-review-moderation.provider";
import type { ReviewModerationOutboxRecord } from "./trip-review-moderation.types";

@Injectable()
export class TripReviewModerationWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(TripReviewModerationWorker.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly provider: TripReviewModerationProvider,
		private readonly configService: ConfigService
	) {}

	onModuleInit(): void {
		const enabled =
			this.configService.get<string>("REVIEW_MODERATION_WORKER_ENABLED") ??
			(process.env.NODE_ENV === "test" ? "false" : "true");
		if (enabled !== "true") return;
		this.timer = setInterval(() => {
			void this.tick();
		}, 3000);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	async tick(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.processPendingOutbox(5);
		} catch (err) {
			this.logger.error(`Moderation worker tick failed: ${err}`);
		} finally {
			this.busy = false;
		}
	}

	/**
	 * Process a single outbox entry, managing leases, calling AI service,
	 * enforcing late-writing fencing, and persisting structured results.
	 */
	async processOutboxRecord(outboxId: string): Promise<boolean> {
		const leaseToken = randomUUID();
		const config = this.provider.configuration();

		// 1. Claim outbox row and obtain/create run row with lease
		const claimed = await this.dataSource.transaction(async (manager) => {
			const rows: ReviewModerationOutboxRecord[] = await manager.query(
				`SELECT id, review_id AS "reviewId", source_revision AS "sourceRevision", 
				        config_version AS "configVersion", created_at AS "createdAt", processed_at AS "processedAt"
				 FROM trip_review_moderation_outbox
				 WHERE id = $1 AND processed_at IS NULL
				 FOR UPDATE SKIP LOCKED`,
				[outboxId]
			);
			if (!rows.length) return null;
			const record = rows[0];

			// Upsert moderation run record and acquire lease
			const leaseUntil = new Date(Date.now() + MODERATION_LEASE_DURATION_MS);
			const runResult: Array<{ id: string; attempts: number }> = await manager.query(
				`INSERT INTO trip_review_moderation_runs (
					review_id, source_revision, provider, model, config_version, prompt_version,
					text_scan_status, image_scan_status, aspects_status, incidents_status,
					lease_token, lease_until, attempts
				 ) VALUES (
					$1, $2, $3, $4, $5, $6, 'running', 'running', 'running', 'running',
					$7, $8, 1
				 )
				 ON CONFLICT (review_id, source_revision, provider, model, config_version, prompt_version)
				 DO UPDATE SET 
					lease_token = $7,
					lease_until = $8,
					attempts = trip_review_moderation_runs.attempts + 1,
					text_scan_status = 'running',
					image_scan_status = 'running',
					aspects_status = 'running',
					incidents_status = 'running'
				 WHERE (trip_review_moderation_runs.completed_at IS NULL OR trip_review_moderation_runs.text_scan_status = 'failed')
				   AND trip_review_moderation_runs.attempts < ${MODERATION_MAX_ATTEMPTS}
				 RETURNING id, attempts`,
				[
					record.reviewId,
					record.sourceRevision,
					config.provider,
					config.model,
					config.configVersion,
					config.promptVersion,
					leaseToken,
					leaseUntil,
				]
			);

			if (!runResult.length) return null;
			return { record, runId: runResult[0].id, leaseToken };
		});

		if (!claimed) return false;

		const { record, runId } = claimed;

		// 2. Fetch revision text and images from database
		const revisionData: Array<{ comment: string | null; images: string[] | null }> =
			await this.dataSource.query(
				"SELECT comment, images FROM trip_review_revisions WHERE review_id = $1 AND revision = $2",
				[record.reviewId, record.sourceRevision]
			);

		if (!revisionData.length) {
			await this.dataSource.query(
				`UPDATE trip_review_moderation_runs 
				 SET text_scan_status = 'failed', image_scan_status = 'failed', 
				     aspects_status = 'failed', incidents_status = 'failed', 
				     error_code = 'REVISION_NOT_FOUND', lease_token = NULL, lease_until = NULL
				 WHERE id = $1`,
				[runId]
			);
			return false;
		}

		const rawComment = revisionData[0].comment;
		const rawImages = revisionData[0].images ?? [];

		// 3. PII masking and server-rule flag detection inside NestJS
		const { maskedText, piiFlags } = maskPii(rawComment);

		// 4. Call AI moderation provider with masked comment (never sends raw PII)
		let scanResponse: Awaited<ReturnType<TripReviewModerationProvider["scanReview"]>>;
		try {
			scanResponse = await this.provider.scanReview(
				rawComment ? maskedText : null,
				rawImages,
				config
			);
		} catch (error) {
			const errorCode = error instanceof ModerationProviderError ? error.code : "provider_failure";
			this.logger.error(`Moderation scan failed for run ${runId}: ${errorCode}`);
			await this.dataSource.query(
				`UPDATE trip_review_moderation_runs 
				 SET text_scan_status = 'failed', image_scan_status = 'failed', 
				     aspects_status = 'failed', incidents_status = 'failed', 
				     error_code = $1, lease_token = NULL, lease_until = NULL
				 WHERE id = $2`,
				[errorCode, runId]
			);
			return false;
		}

		// 5. Persist results conditionally with late-writing revision fencing & lease fencing
		return await this.dataSource.transaction(async (manager: EntityManager) => {
			// A. Acquire revision fence on parent review
			const currentReviews: Array<{ revision: number }> = await manager.query(
				"SELECT revision FROM trip_reviews WHERE id = $1 FOR UPDATE",
				[record.reviewId]
			);
			if (!currentReviews.length) return false;

			const isObsoleteRevision = currentReviews[0].revision > record.sourceRevision;
			const flagLifecycleStatus = isObsoleteRevision ? "superseded" : "active";

			// B. Enforce lease fence on run row
			const completedAt = new Date();
			const updateRun = await manager.query(
				`UPDATE trip_review_moderation_runs
				 SET text_scan_status = $1,
				     image_scan_status = $2,
				     aspects_status = $3,
				     incidents_status = $4,
				     completed_at = $5,
				     lease_token = NULL,
				     lease_until = NULL
				 WHERE id = $6 AND lease_token = $7 AND lease_until >= clock_timestamp()`,
				[
					scanResponse.text_scan_status,
					scanResponse.image_scan_status,
					scanResponse.aspects_status,
					scanResponse.incidents_status,
					completedAt,
					runId,
					leaseToken,
				]
			);

			if (updateRun[1] === 0 && updateRun.length === 0) {
				// Fenced out by expired lease! Rollback.
				throw new Error("LEASE_EXPIRED_FENCE");
			}

			// C. Insert image items
			for (const img of scanResponse.image_items) {
				await manager.query(
					`INSERT INTO trip_review_moderation_image_items (
						run_id, review_id, source_revision, image_index, storage_key,
						scan_status, has_violation, flag_type, confidence, evidence, scanned_at
					 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
					 ON CONFLICT (run_id, image_index) DO NOTHING`,
					[
						runId,
						record.reviewId,
						record.sourceRevision,
						img.image_index,
						img.storage_key,
						img.scan_status,
						img.has_violation ?? null,
						img.flag_type ?? null,
						img.confidence ?? null,
						img.evidence ?? null,
						completedAt,
					]
				);
			}

			// D. Insert rule-detected PII flags
			for (const pii of piiFlags) {
				await manager.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, $3, 'text', NULL, $4, 'rule', NULL, $5, $6, $7)
					 ON CONFLICT DO NOTHING`,
					[
						runId,
						record.reviewId,
						record.sourceRevision,
						pii.flagType,
						pii.evidence,
						pii.quote,
						flagLifecycleStatus,
					]
				);
			}

			// E. Insert model-detected text flags (personal_data_leak is forbidden for model)
			for (const flag of scanResponse.flags) {
				if (flag.flag_type === "personal_data_leak") {
					continue; // Model is strictly forbidden from generating personal_data_leak
				}
				await manager.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, $3, 'text', NULL, $4, 'model', $5, $6, $7, $8)
					 ON CONFLICT DO NOTHING`,
					[
						runId,
						record.reviewId,
						record.sourceRevision,
						flag.flag_type,
						flag.confidence,
						flag.evidence,
						flag.quote,
						flagLifecycleStatus,
					]
				);
			}

			// F. Insert aspect sentiments
			for (const aspect of scanResponse.aspect_sentiments) {
				await manager.query(
					`INSERT INTO trip_review_aspect_sentiments (
						run_id, review_id, source_revision, aspect, sentiment, confidence, quote
					 ) VALUES ($1, $2, $3, $4, $5, $6, $7)
					 ON CONFLICT (run_id, aspect) DO NOTHING`,
					[
						runId,
						record.reviewId,
						record.sourceRevision,
						aspect.aspect,
						aspect.sentiment,
						aspect.confidence,
						aspect.quote ?? null,
					]
				);
			}

			// G. Insert incident signals
			for (const incident of scanResponse.incident_signals) {
				await manager.query(
					`INSERT INTO trip_review_incident_signals (
						run_id, review_id, source_revision, incident_type, occurred, severity, quote
					 ) VALUES ($1, $2, $3, $4, $5, $6, $7)
					 ON CONFLICT DO NOTHING`,
					[
						runId,
						record.reviewId,
						record.sourceRevision,
						incident.incident_type,
						incident.occurred,
						incident.severity,
						incident.quote,
					]
				);
			}

			// H. Mark outbox entry as processed
			await manager.query(
				"UPDATE trip_review_moderation_outbox SET processed_at = clock_timestamp() WHERE id = $1",
				[record.id]
			);

			return true;
		});
	}

	/**
	 * Scans pending outbox records with SKIP LOCKED batch claiming.
	 */
	async processPendingOutbox(limit = 10): Promise<number> {
		const pendingRows: Array<{ id: string }> = await this.dataSource.query(
			`SELECT id FROM trip_review_moderation_outbox 
			 WHERE processed_at IS NULL 
			 ORDER BY created_at ASC 
			 LIMIT $1`,
			[limit]
		);

		let successCount = 0;
		for (const row of pendingRows) {
			try {
				const success = await this.processOutboxRecord(row.id);
				if (success) successCount++;
			} catch (err) {
				this.logger.warn(`Failed processing outbox ${row.id}: ${err}`);
			}
		}
		return successCount;
	}
}
