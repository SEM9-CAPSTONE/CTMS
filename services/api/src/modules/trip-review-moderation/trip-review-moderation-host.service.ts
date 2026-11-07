import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import {
	type CreateModerationDecisionDto,
	ModerationDecisionAction,
} from "./dtos/create-moderation-decision.dto";
import {
	type GetHostModerationQueueQueryDto,
	ModerationQueueStatusFilter,
} from "./dtos/get-host-moderation-queue-query.dto";
import type { ModerationDecisionResponseDto } from "./dtos/moderation-decision-response.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import type {
	DetectionSource,
	HostModerationDecision,
	ImageStorageState,
	ModerationFlagType,
	ModerationQueueItem,
	ModerationStatus,
} from "./trip-review-moderation.types";

interface ReviewRow {
	id: string;
	tripId: string;
	tripTitle: string;
	reviewerId: string;
	hostId: string;
	rating: number;
	comment: string | null;
	images: string[] | null;
	revision: number;
	createdAt: Date;
	moderationStatus: ModerationStatus;
	imageStorageState: ImageStorageState;
	hiddenReason: ModerationFlagType | null;
}

interface FlagRow {
	id: string;
	reviewId: string;
	flagType: ModerationFlagType;
	channel: "text" | "image";
	detectionSource: DetectionSource;
	confidence: number | null;
	evidence: string;
	quote: string | null;
	targetImageIndex: number | null;
	createdAt: Date;
}

@Injectable()
export class TripReviewModerationHostService {
	private readonly logger = new Logger(TripReviewModerationHostService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly imageStorage: TripReviewImageStorageService
	) {}

	/**
	 * Retrieve queue items for the host, supporting filters for pending_review, hidden, or resolved.
	 */
	async getQueue(
		hostId: string,
		query: GetHostModerationQueueQueryDto
	): Promise<{ items: ModerationQueueItem[]; total: number; page: number; limit: number }> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 10;
		const offset = (page - 1) * limit;

		let statusCondition = "";
		if (query.status === ModerationQueueStatusFilter.PENDING_REVIEW) {
			statusCondition = `AND r.moderation_status = 'visible' 
			                   AND EXISTS (SELECT 1 FROM trip_review_moderation_flags f 
			                               WHERE f.review_id = r.id AND f.lifecycle_status = 'active')`;
		} else if (query.status === ModerationQueueStatusFilter.HIDDEN) {
			statusCondition = "AND r.moderation_status = 'hidden'";
		} else if (query.status === ModerationQueueStatusFilter.RESOLVED) {
			statusCondition = `AND (
				EXISTS (SELECT 1 FROM trip_review_moderation_decisions d WHERE d.review_id = r.id AND d.revision = r.revision)
				OR NOT EXISTS (SELECT 1 FROM trip_review_moderation_flags f WHERE f.review_id = r.id AND f.lifecycle_status = 'active')
			)`;
		}

		const tripFilter = query.tripId ? "AND r.trip_id = $2" : "";
		const params: unknown[] = [hostId];
		if (query.tripId) params.push(query.tripId);

		const countResult: Array<{ count: string }> = await this.dataSource.query(
			`SELECT count(r.id)::text AS count
			 FROM trip_reviews r
			 JOIN trips t ON t.id = r.trip_id
			 WHERE t.host_id = $1 ${tripFilter} ${statusCondition}`,
			params
		);
		const total = Number.parseInt(countResult[0]?.count ?? "0", 10);

		const queryParams = [...params, limit, offset];
		const limitPlaceholder = `$${params.length + 1}`;
		const offsetPlaceholder = `$${params.length + 2}`;

		const rows: ReviewRow[] = await this.dataSource.query(
			`SELECT r.id, r.trip_id AS "tripId", t.title AS "tripTitle",
			        r.reviewer_id AS "reviewerId", t.host_id AS "hostId",
			        r.rating, r.comment, r.images, r.revision,
			        r.created_at AS "createdAt", r.moderation_status AS "moderationStatus",
			        r.image_storage_state AS "imageStorageState", r.hidden_reason AS "hiddenReason"
			 FROM trip_reviews r
			 JOIN trips t ON t.id = r.trip_id
			 WHERE t.host_id = $1 ${tripFilter} ${statusCondition}
			 ORDER BY r.created_at DESC
			 LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
			queryParams
		);

		if (!rows.length) {
			return { items: [], total, page, limit };
		}

		const reviewIds = rows.map((r) => r.id);
		const flagRows: FlagRow[] = await this.dataSource.query(
			`SELECT id, review_id AS "reviewId", flag_type AS "flagType", channel,
			        detection_source AS "detectionSource", confidence, evidence, quote,
			        target_image_index AS "targetImageIndex", created_at AS "createdAt"
			 FROM trip_review_moderation_flags
			 WHERE review_id = ANY($1) AND lifecycle_status = 'active'
			 ORDER BY created_at ASC`,
			[reviewIds]
		);

		const flagsByReview = new Map<string, FlagRow[]>();
		for (const flag of flagRows) {
			const list = flagsByReview.get(flag.reviewId) ?? [];
			list.push(flag);
			flagsByReview.set(flag.reviewId, list);
		}

		const items: ModerationQueueItem[] = rows.map((r) => ({
			reviewId: r.id,
			tripId: r.tripId,
			tripTitle: r.tripTitle,
			reviewerId: r.reviewerId,
			rating: r.rating,
			comment: r.comment,
			images: r.images ?? [],
			sourceRevision: r.revision,
			createdAt: r.createdAt,
			moderationStatus: r.moderationStatus,
			imageStorageState: r.imageStorageState,
			hiddenReason: r.hiddenReason,
			activeFlags: (flagsByReview.get(r.id) ?? []).map((f) => ({
				id: f.id,
				flagType: f.flagType,
				channel: f.channel,
				detectionSource: f.detectionSource,
				confidence: f.confidence,
				evidence: f.evidence,
				quote: f.quote,
				targetImageIndex: f.targetImageIndex,
				createdAt: f.createdAt,
			})),
		}));

		return { items, total, page, limit };
	}

	/**
	 * Process host moderation decision with concurrency control, Admin override protection,
	 * flag resolution, and physical image quarantine coordination.
	 */
	async recordDecision(
		hostId: string,
		reviewId: string,
		dto: CreateModerationDecisionDto
	): Promise<ModerationDecisionResponseDto> {
		const result = await this.dataSource.transaction(async (manager) => {
			// 1. Fetch review with lock to guard against concurrent edits
			const reviews: ReviewRow[] = await manager.query(
				`SELECT r.id, r.trip_id AS "tripId", t.title AS "tripTitle",
				        r.reviewer_id AS "reviewerId", t.host_id AS "hostId",
				        r.rating, r.comment, r.images, r.revision,
				        r.created_at AS "createdAt", r.moderation_status AS "moderationStatus",
				        r.image_storage_state AS "imageStorageState", r.hidden_reason AS "hiddenReason"
				 FROM trip_reviews r
				 JOIN trips t ON t.id = r.trip_id
				 WHERE r.id = $1
				 FOR UPDATE OF r`,
				[reviewId]
			);

			if (!reviews.length) {
				throw new NotFoundException("Review not found");
			}

			const review = reviews[0];

			// 2. Ownership check
			if (review.hostId !== hostId) {
				throw new ForbiddenException("You are not authorized to moderate reviews for this trip");
			}

			// 3. Stale revision check (Concurrency control)
			if (review.revision !== dto.expectedRevision) {
				throw new ConflictException(
					"Review has been edited by camper; please refresh the review before making a decision"
				);
			}

			// 4. Branch based on Host decision
			if (dto.decision === ModerationDecisionAction.HIDE) {
				// Require reason to match at least one active flag
				const activeFlags: Array<{ flag_type: ModerationFlagType }> = await manager.query(
					`SELECT flag_type FROM trip_review_moderation_flags 
					 WHERE review_id = $1 AND lifecycle_status = 'active'`,
					[reviewId]
				);

				const matchingFlag = activeFlags.some((f) => f.flag_type === dto.reason);
				if (!matchingFlag) {
					throw new BadRequestException(
						`Hidden reason '${dto.reason}' must match an active violation flag on this review`
					);
				}

				// Resolve all active flags
				await manager.query(
					`UPDATE trip_review_moderation_flags 
					 SET lifecycle_status = 'resolved', resolved_at = clock_timestamp(), resolved_by = $1
					 WHERE review_id = $2 AND lifecycle_status = 'active'`,
					[hostId, reviewId]
				);

				// Record host decision
				const decisionResult: Array<{ id: string; created_at: Date }> = await manager.query(
					`INSERT INTO trip_review_moderation_decisions (review_id, revision, host_id, decision, reason, note)
					 VALUES ($1, $2, $3, 'hide', $4, $5)
					 ON CONFLICT (review_id, revision, host_id)
					 DO UPDATE SET decision = 'hide', reason = EXCLUDED.reason, note = EXCLUDED.note, created_at = clock_timestamp()
					 RETURNING id, created_at`,
					[reviewId, review.revision, hostId, dto.reason, dto.note ?? null]
				);

				const hasImages = Array.isArray(review.images) && review.images.length > 0;
				const pendingImageState: ImageStorageState = hasImages ? "quarantine_pending" : "live";

				// Update review moderation status
				await manager.query(
					`UPDATE trip_reviews
					 SET moderation_status = 'hidden',
					     hidden_at = clock_timestamp(),
					     hidden_reason = $1,
					     hidden_by = $2,
					     hidden_revision = $3,
					     image_storage_state = $4
					 WHERE id = $5`,
					[dto.reason, hostId, review.revision, pendingImageState, reviewId]
				);

				return {
					decisionId: decisionResult[0].id,
					reviewId,
					revision: review.revision,
					decision: "hide" as HostModerationDecision,
					reason: dto.reason ?? null,
					moderationStatus: "hidden" as ModerationStatus,
					imageStorageState: pendingImageState,
					adminActionedOverride: false,
					message: "Review successfully hidden",
					createdAt: decisionResult[0].created_at,
					imagesToQuarantine: hasImages ? review.images : null,
					imagesToRestore: null,
				};
			}

			if (dto.decision === ModerationDecisionAction.KEEP) {
				// Resolve all active flags
				await manager.query(
					`UPDATE trip_review_moderation_flags 
					 SET lifecycle_status = 'resolved', resolved_at = clock_timestamp(), resolved_by = $1
					 WHERE review_id = $2 AND lifecycle_status = 'active'`,
					[hostId, reviewId]
				);

				// Record host decision
				const decisionResult: Array<{ id: string; created_at: Date }> = await manager.query(
					`INSERT INTO trip_review_moderation_decisions (review_id, revision, host_id, decision, reason, note)
					 VALUES ($1, $2, $3, 'keep', NULL, $4)
					 ON CONFLICT (review_id, revision, host_id)
					 DO UPDATE SET decision = 'keep', reason = NULL, note = EXCLUDED.note, created_at = clock_timestamp()
					 RETURNING id, created_at`,
					[reviewId, review.revision, hostId, dto.note ?? null]
				);

				return {
					decisionId: decisionResult[0].id,
					reviewId,
					revision: review.revision,
					decision: "keep" as HostModerationDecision,
					reason: null,
					moderationStatus: "visible" as ModerationStatus,
					imageStorageState: review.imageStorageState,
					adminActionedOverride: false,
					message: "Review flags dismissed; review remains visible",
					createdAt: decisionResult[0].created_at,
					imagesToQuarantine: null,
					imagesToRestore: null,
				};
			}

			if (dto.decision === ModerationDecisionAction.RESTORE) {
				// 1. Check if an actioned Admin content report exists
				const adminReports: Array<{ id: string }> = await manager.query(
					`SELECT id FROM content_reports 
					 WHERE target_id = $1 AND target_type IN ('trip_review', 'review') AND status = 'actioned'
					 LIMIT 1`,
					[reviewId]
				);

				const hasAdminActioned = adminReports.length > 0;

				// Record decision regardless
				const decisionResult: Array<{ id: string; created_at: Date }> = await manager.query(
					`INSERT INTO trip_review_moderation_decisions (review_id, revision, host_id, decision, reason, note)
					 VALUES ($1, $2, $3, 'restore', NULL, $4)
					 ON CONFLICT (review_id, revision, host_id)
					 DO UPDATE SET decision = 'restore', reason = NULL, note = EXCLUDED.note, created_at = clock_timestamp()
					 RETURNING id, created_at`,
					[reviewId, review.revision, hostId, dto.note ?? null]
				);

				if (hasAdminActioned) {
					// Admin actioned report takes precedence: Host restore cannot make review visible!
					return {
						decisionId: decisionResult[0].id,
						reviewId,
						revision: review.revision,
						decision: "restore" as HostModerationDecision,
						reason: null,
						moderationStatus: "hidden" as ModerationStatus,
						imageStorageState: review.imageStorageState,
						adminActionedOverride: true,
						message:
							"Host decision recorded as restore, but review remains hidden due to prior Admin moderation action",
						createdAt: decisionResult[0].created_at,
						imagesToQuarantine: null,
						imagesToRestore: null,
					};
				}

				// If no Admin report actioned, restore review to visible
				const hasImages = Array.isArray(review.images) && review.images.length > 0;
				const pendingImageState: ImageStorageState = hasImages ? "restore_pending" : "live";

				await manager.query(
					`UPDATE trip_reviews
					 SET moderation_status = 'visible',
					     hidden_at = NULL,
					     hidden_reason = NULL,
					     hidden_by = NULL,
					     hidden_revision = NULL,
					     image_storage_state = $1
					 WHERE id = $2`,
					[pendingImageState, reviewId]
				);

				return {
					decisionId: decisionResult[0].id,
					reviewId,
					revision: review.revision,
					decision: "restore" as HostModerationDecision,
					reason: null,
					moderationStatus: "visible" as ModerationStatus,
					imageStorageState: pendingImageState,
					adminActionedOverride: false,
					message: "Review successfully restored to public view",
					createdAt: decisionResult[0].created_at,
					imagesToQuarantine: null,
					imagesToRestore: hasImages ? review.images : null,
				};
			}

			throw new BadRequestException("Unsupported decision action");
		});

		// 5. Physical image file operations outside DB transaction
		let finalImageStorageState = result.imageStorageState;

		if (result.imagesToQuarantine) {
			const success = await this.imageStorage.quarantineImages(result.imagesToQuarantine);
			finalImageStorageState = success ? "quarantined" : "quarantine_failed";
			await this.dataSource.query(
				"UPDATE trip_reviews SET image_storage_state = $1 WHERE id = $2",
				[finalImageStorageState, reviewId]
			);
		} else if (result.imagesToRestore) {
			const success = await this.imageStorage.restoreImages(result.imagesToRestore);
			finalImageStorageState = success ? "live" : "restore_failed";
			await this.dataSource.query(
				"UPDATE trip_reviews SET image_storage_state = $1 WHERE id = $2",
				[finalImageStorageState, reviewId]
			);
		}

		return {
			decisionId: result.decisionId,
			reviewId: result.reviewId,
			revision: result.revision,
			decision: result.decision,
			reason: result.reason,
			moderationStatus: result.moderationStatus,
			imageStorageState: finalImageStorageState,
			adminActionedOverride: result.adminActionedOverride,
			message: result.message,
			createdAt: result.createdAt,
		};
	}

	/**
	 * Retrieve a quarantined image file for host evidence inspection, logging access for audit.
	 */
	async getQuarantinedImageFile(
		hostId: string,
		reviewId: string,
		imageIndex: number
	): Promise<{ filePath: string; filename: string }> {
		const reviews: ReviewRow[] = await this.dataSource.query(
			`SELECT r.id, r.images, r.image_storage_state AS "imageStorageState", t.host_id AS "hostId"
			 FROM trip_reviews r
			 JOIN trips t ON t.id = r.trip_id
			 WHERE r.id = $1`,
			[reviewId]
		);

		if (!reviews.length) {
			throw new NotFoundException("Review not found");
		}

		const review = reviews[0];
		if (review.hostId !== hostId) {
			throw new ForbiddenException("You are not authorized to view evidence for this review");
		}

		if (
			review.imageStorageState === "quarantine_pending" ||
			review.imageStorageState === "restore_pending"
		) {
			throw new ConflictException("Image file operation in progress; please retry in a moment");
		}

		const images = review.images ?? [];
		if (imageIndex < 0 || imageIndex >= images.length) {
			throw new NotFoundException("Image index out of bounds");
		}

		const targetUrl = images[imageIndex];
		const filePath = this.imageStorage.getQuarantinedPath(targetUrl);
		if (!filePath) {
			throw new NotFoundException("Quarantined image file not found on disk");
		}

		const filename = this.imageStorage.extractFilename(targetUrl) ?? "image.jpg";

		// Audit log for host evidence access
		await this.dataSource.getRepository(AuditLog).save({
			actorId: hostId,
			action: "trip_review_image.view_quarantined",
			targetType: "trip_review",
			targetId: reviewId,
			before: null,
			after: { imageIndex, filename },
			reason: "Host inspected quarantined image evidence",
		});

		return { filePath, filename };
	}
}
