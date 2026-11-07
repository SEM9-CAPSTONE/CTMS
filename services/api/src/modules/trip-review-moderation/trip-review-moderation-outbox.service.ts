import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { MODERATION_DEFAULT_CONFIG_VERSION } from "./trip-review-moderation.constants";

export interface ReviewSnapshotForModeration {
	id: string;
	revision: number;
	comment?: string | null;
	images?: string[] | null;
}

@Injectable()
export class TripReviewModerationOutboxService {
	private readonly configVersion: string;

	constructor() {
		this.configVersion =
			process.env.REVIEW_MODERATION_CONFIG_VERSION ?? MODERATION_DEFAULT_CONFIG_VERSION;
	}

	async onReviewCreated(
		manager: EntityManager,
		review: ReviewSnapshotForModeration
	): Promise<void> {
		if (!this.isEligibleForScan(review)) {
			return;
		}

		await manager.query(
			`INSERT INTO trip_review_moderation_outbox (review_id, source_revision, config_version)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (review_id, source_revision, config_version) DO NOTHING`,
			[review.id, review.revision, this.configVersion]
		);
	}

	async onReviewUpdated(
		manager: EntityManager,
		review: ReviewSnapshotForModeration
	): Promise<void> {
		// 1. Supersede all active flags from previous revisions within the same transaction
		await manager.query(
			`UPDATE trip_review_moderation_flags 
			 SET lifecycle_status = 'superseded' 
			 WHERE review_id = $1 AND lifecycle_status = 'active'`,
			[review.id]
		);

		// 2. Enqueue only if new revision has text or images
		if (!this.isEligibleForScan(review)) {
			return;
		}

		await manager.query(
			`INSERT INTO trip_review_moderation_outbox (review_id, source_revision, config_version)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (review_id, source_revision, config_version) DO NOTHING`,
			[review.id, review.revision, this.configVersion]
		);
	}

	private isEligibleForScan(review: ReviewSnapshotForModeration): boolean {
		const hasText =
			review.comment !== null && review.comment !== undefined && review.comment.trim().length > 0;
		const hasImages = Array.isArray(review.images) && review.images.length > 0;
		return hasText || hasImages;
	}
}
