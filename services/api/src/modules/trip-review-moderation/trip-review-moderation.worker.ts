import { randomUUID } from "node:crypto";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { InAppNotificationType } from "../in-app-notifications/in-app-notification.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { InAppNotificationsService } from "../in-app-notifications/in-app-notifications.service";
import { maskPii } from "./pii-masker";
// biome-ignore lint/style/useImportType: Nest injection
import { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import {
	MODERATION_HOST_SLA_MS,
	MODERATION_LEASE_DURATION_MS,
	MODERATION_MAX_ATTEMPTS,
	MODERATION_NOTIFY_HOST_MIN_THRESHOLD_BPS,
	MODERATION_UNVERIFIED_TIMEOUT_MS,
} from "./trip-review-moderation.constants";
import { confidenceToBasisPoints, evaluateModerationPolicy } from "./trip-review-moderation.policy";
import {
	ModerationProviderError,
	// biome-ignore lint/style/useImportType: Nest injection
	TripReviewModerationProvider,
} from "./trip-review-moderation.provider";
import type {
	EvaluableModerationFlag,
	ImageStorageState,
	ModerationHiddenSource,
	ModerationStatus,
	ReviewModerationOutboxRecord,
} from "./trip-review-moderation.types";

interface LockedReviewRow {
	revision: number;
	tripId: string;
	hostId: string;
	moderationStatus: ModerationStatus;
	hiddenSource: ModerationHiddenSource | null;
	images: string[] | null;
	imageStorageState: ImageStorageState;
}

@Injectable()
export class TripReviewModerationWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(TripReviewModerationWorker.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly provider: TripReviewModerationProvider,
		private readonly configService: ConfigService,
		private readonly imageStorage: TripReviewImageStorageService,
		private readonly notifications: InAppNotificationsService
	) {}

	onModuleInit(): void {
		const enabled =
			this.configService.get<string>("REVIEW_MODERATION_WORKER_ENABLED") ??
			(process.env.NODE_ENV === "test" ? "false" : "true");
		if (enabled !== "true") return;
		this.timer = setInterval(() => {
			void this.tick();
		}, 1000);
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
			await this.processUnverifiedTimeouts();
			await this.processHostModerationSlaEscalations();
		} catch (err) {
			this.logger.error(`Moderation worker tick failed: ${err}`);
		} finally {
			this.busy = false;
		}
	}

	/**
	 * Process a single outbox entry, managing leases, calling AI service,
	 * enforcing late-writing fencing, persisting structured results,
	 * applying auto-hide/restore policy, and enqueueing idempotent notifications.
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
		const postCommit = await this.dataSource.transaction(async (manager: EntityManager) => {
			// A. Acquire revision fence on parent review
			const currentReviews: LockedReviewRow[] = await manager.query(
				`SELECT revision,
				        trip_id AS "tripId",
				        host_id AS "hostId",
				        moderation_status AS "moderationStatus",
				        hidden_source AS "hiddenSource",
				        images,
				        image_storage_state AS "imageStorageState"
				 FROM trip_reviews
				 WHERE id = $1
				 FOR UPDATE`,
				[record.reviewId]
			);
			if (!currentReviews.length) {
				return { ok: false as const, imagesToQuarantine: null, imagesToRestore: null };
			}

			const currentReview = currentReviews[0];
			const isObsoleteRevision = currentReview.revision > record.sourceRevision;

			// Respect prior Host restore/keep on the same revision so re-scan never re-hides it
			const hostDecisions: Array<{ decision: string }> = await manager.query(
				`SELECT decision
				 FROM trip_review_moderation_decisions
				 WHERE review_id = $1 AND revision = $2 AND decision IN ('restore', 'keep')
				 LIMIT 1`,
				[record.reviewId, record.sourceRevision]
			);
			const hasHostKeptOrRestored = hostDecisions.length > 0;
			const flagLifecycleStatus = isObsoleteRevision
				? "superseded"
				: hasHostKeptOrRestored
					? "resolved"
					: "active";

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
				throw new Error("LEASE_EXPIRED_FENCE");
			}

			const evaluableFlags: EvaluableModerationFlag[] = [];

			// C. Insert image items and mirror image violations into moderation flags
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

				if (img.has_violation === true && img.flag_type) {
					const imgBps = confidenceToBasisPoints(img.confidence ?? null, "model");
					const effectiveImgLifecycle =
						imgBps >= MODERATION_NOTIFY_HOST_MIN_THRESHOLD_BPS ? flagLifecycleStatus : "resolved";
					await manager.query(
						`INSERT INTO trip_review_moderation_flags (
							run_id, review_id, source_revision, channel, target_image_index,
							flag_type, detection_source, confidence, evidence, quote, lifecycle_status
						 ) VALUES ($1, $2, $3, 'image', $4, $5, 'model', $6, $7, NULL, $8)
						 ON CONFLICT DO NOTHING`,
						[
							runId,
							record.reviewId,
							record.sourceRevision,
							img.image_index,
							img.flag_type,
							img.confidence ?? null,
							img.evidence ?? "Hình ảnh không phù hợp với tiêu chuẩn cộng đồng",
							effectiveImgLifecycle,
						]
					);
					evaluableFlags.push({
						flagType: img.flag_type,
						detectionSource: "model",
						confidence: img.confidence ?? null,
					});
				}
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
				evaluableFlags.push({
					flagType: pii.flagType,
					detectionSource: "rule",
					confidence: null,
				});
			}

			// E. Insert model-detected text flags (personal_data_leak is forbidden for model)
			for (const flag of scanResponse.flags) {
				if (flag.flag_type === "personal_data_leak") {
					continue;
				}
				const textBps = confidenceToBasisPoints(flag.confidence, "model");
				const effectiveTextLifecycle =
					textBps >= MODERATION_NOTIFY_HOST_MIN_THRESHOLD_BPS ? flagLifecycleStatus : "resolved";
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
						effectiveTextLifecycle,
					]
				);
				evaluableFlags.push({
					flagType: flag.flag_type,
					detectionSource: "model",
					confidence: flag.confidence,
				});
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

			// H. Evaluate auto-hide / notify-host / auto-restore policy for current revision
			let imagesToQuarantine: string[] | null = null;
			let imagesToRestore: string[] | null = null;

			if (!isObsoleteRevision) {
				await manager.query(
					`UPDATE trip_reviews
					 SET moderation_verification_status = 'verified'
					 WHERE id = $1`,
					[record.reviewId]
				);

				if (!hasHostKeptOrRestored) {
					const outcome = evaluateModerationPolicy(evaluableFlags);
					const reviewImages = Array.isArray(currentReview.images) ? currentReview.images : [];
					const hasImages = reviewImages.length > 0;

					if (outcome.action === "auto_hide") {
						const nextImageState: ImageStorageState = hasImages
							? "quarantine_pending"
							: currentReview.imageStorageState;
						await manager.query(
							`UPDATE trip_reviews
							 SET moderation_status = 'hidden',
							     hidden_at = clock_timestamp(),
							     first_hidden_at = COALESCE(first_hidden_at, clock_timestamp()),
							     hidden_reason = $1,
							     hidden_by = NULL,
							     hidden_source = 'ai',
							     hidden_revision = $2,
							     image_storage_state = $3
							 WHERE id = $4`,
							[outcome.hiddenReason, record.sourceRevision, nextImageState, record.reviewId]
						);
						await this.notifications.enqueueTripReviewModeration(manager, {
							tripId: currentReview.tripId,
							reviewId: record.reviewId,
							eventType: InAppNotificationType.REVIEW_AUTO_HIDDEN,
							sourceKey: `review-moderation:auto-hidden:${record.reviewId}:rev:${record.sourceRevision}`,
							occurredAt: completedAt,
						});
						if (hasImages) {
							imagesToQuarantine = reviewImages;
						}
					} else if (outcome.action === "notify_host") {
						await this.notifications.enqueueTripReviewModeration(manager, {
							tripId: currentReview.tripId,
							reviewId: record.reviewId,
							eventType: InAppNotificationType.REVIEW_MODERATION_FLAGGED,
							sourceKey: `review-moderation:flagged:${record.reviewId}:rev:${record.sourceRevision}`,
							occurredAt: completedAt,
						});
					} else if (
						outcome.action === "clean" &&
						currentReview.moderationStatus === "hidden" &&
						currentReview.hiddenSource === "ai"
					) {
						const adminReports: Array<{ id: string }> = await manager.query(
							`SELECT id
							 FROM content_reports
							 WHERE target_id = $1
							   AND target_type IN ('trip_review', 'review')
							   AND status = 'actioned'
							 LIMIT 1`,
							[record.reviewId]
						);
						if (adminReports.length === 0) {
							const nextImageState: ImageStorageState = hasImages ? "restore_pending" : "live";
							await manager.query(
								`UPDATE trip_reviews
								 SET moderation_status = 'visible',
								     hidden_at = NULL,
								     hidden_reason = NULL,
								     hidden_by = NULL,
								     hidden_source = NULL,
								     hidden_revision = NULL,
								     image_storage_state = $1
								 WHERE id = $2`,
								[nextImageState, record.reviewId]
							);
							if (hasImages) {
								imagesToRestore = reviewImages;
							}
						}
					}
				}
			}

			// I. Mark outbox entry as processed
			await manager.query(
				"UPDATE trip_review_moderation_outbox SET processed_at = clock_timestamp() WHERE id = $1",
				[record.id]
			);

			return { ok: true as const, imagesToQuarantine, imagesToRestore };
		});

		if (!postCommit.ok) return false;

		if (postCommit.imagesToQuarantine) {
			const moved = await this.imageStorage.quarantineImages(postCommit.imagesToQuarantine);
			await this.dataSource.query(
				"UPDATE trip_reviews SET image_storage_state = $1 WHERE id = $2",
				[moved ? "quarantined" : "quarantine_failed", record.reviewId]
			);
		} else if (postCommit.imagesToRestore) {
			const restored = await this.imageStorage.restoreImages(postCommit.imagesToRestore);
			await this.dataSource.query(
				"UPDATE trip_reviews SET image_storage_state = $1 WHERE id = $2",
				[restored ? "live" : "restore_failed", record.reviewId]
			);
		}

		return true;
	}

	/**
	 * Safeguard 1 (15 minutes): If AI moderation fails/retries past 15 minutes
	 * or exhausts max attempts, mark the review as unverified and notify Host.
	 */
	async processUnverifiedTimeouts(now: Date = new Date()): Promise<number> {
		const cutoff = new Date(now.getTime() - MODERATION_UNVERIFIED_TIMEOUT_MS);
		const stuckRows: Array<{ reviewId: string; tripId: string; revision: number }> =
			await this.dataSource.query(
				`SELECT DISTINCT r.id AS "reviewId", r.trip_id AS "tripId", r.revision
				 FROM trip_reviews r
				 INNER JOIN trip_review_moderation_outbox o
				   ON o.review_id = r.id
				   AND o.source_revision = r.revision
				   AND o.processed_at IS NULL
				 LEFT JOIN trip_review_moderation_runs run
				   ON run.review_id = r.id
				   AND run.source_revision = r.revision
				 WHERE r.moderation_verification_status <> 'unverified'
				   AND (
				     o.created_at <= $1
				     OR (run.text_scan_status = 'failed' AND run.attempts >= $2)
				   )`,
				[cutoff, MODERATION_MAX_ATTEMPTS]
			);

		let updatedCount = 0;
		for (const row of stuckRows) {
			await this.dataSource.transaction(async (manager) => {
				await manager.query(
					`UPDATE trip_reviews
					 SET moderation_verification_status = 'unverified'
					 WHERE id = $1 AND revision = $2`,
					[row.reviewId, row.revision]
				);
				await this.notifications.enqueueTripReviewModeration(manager, {
					tripId: row.tripId,
					reviewId: row.reviewId,
					eventType: InAppNotificationType.REVIEW_MODERATION_UNVERIFIED,
					sourceKey: `review-moderation:unverified:${row.reviewId}:rev:${row.revision}`,
					occurredAt: now,
				});
			});
			updatedCount += 1;
		}
		return updatedCount;
	}

	/**
	 * Safeguard 2 (7 days): If a visible review with active <= 80% flags remains
	 * unresolved by Host for >= 7 days, send a Host reminder and escalate to Admins.
	 */
	async processHostModerationSlaEscalations(now: Date = new Date()): Promise<number> {
		const cutoff = new Date(now.getTime() - MODERATION_HOST_SLA_MS);
		const overdueRows: Array<{ reviewId: string; tripId: string; revision: number }> =
			await this.dataSource.query(
				`SELECT r.id AS "reviewId", r.trip_id AS "tripId", r.revision
				 FROM trip_reviews r
				 INNER JOIN trip_review_moderation_flags f
				   ON f.review_id = r.id
				   AND f.source_revision = r.revision
				   AND f.lifecycle_status = 'active'
				 WHERE r.moderation_status = 'visible'
				   AND NOT EXISTS (
				     SELECT 1
				     FROM trip_review_moderation_decisions d
				     WHERE d.review_id = r.id AND d.revision = r.revision
				   )
				 GROUP BY r.id, r.trip_id, r.revision
				 HAVING MIN(f.created_at) <= $1`,
				[cutoff]
			);

		let escalatedCount = 0;
		for (const row of overdueRows) {
			await this.dataSource.transaction(async (manager) => {
				await this.notifications.enqueueTripReviewModeration(manager, {
					tripId: row.tripId,
					reviewId: row.reviewId,
					eventType: InAppNotificationType.REVIEW_MODERATION_REMINDER,
					sourceKey: `review-moderation:sla-reminder:${row.reviewId}:rev:${row.revision}`,
					occurredAt: now,
				});
				await this.notifications.enqueueTripReviewModeration(manager, {
					tripId: row.tripId,
					reviewId: row.reviewId,
					eventType: InAppNotificationType.REVIEW_MODERATION_ESCALATED,
					sourceKey: `review-moderation:sla-escalated:${row.reviewId}:rev:${row.revision}`,
					occurredAt: now,
				});
			});
			escalatedCount += 1;
		}
		return escalatedCount;
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
