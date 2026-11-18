import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { CreatePorterReviewDto, UpdatePorterReviewDto } from "./dto/porter-review.dto";
import { canEditPorterReview, porterReviewEligibility } from "./porter-reviews.policy";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { PorterReviewsRepository } from "./porter-reviews.repository";
import {
	type PorterReviewContext,
	PorterReviewIneligibleReason,
	type PorterReviewParticipation,
	type PorterReviewRecord,
} from "./porter-reviews.types";

@Injectable()
export class PorterReviewsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly reviews: PorterReviewsRepository
	) {}

	context(userId: string, bookingId: string): Promise<PorterReviewContext> {
		return this.dataSource.transaction(async (manager) => {
			const participation = await this.requireParticipation(manager, userId, bookingId);
			const porters = await this.reviews.assignedPorters(manager, participation.tripId);
			const own = await this.reviews.listOwn(manager, userId, bookingId);
			const names = await this.reviews.names(
				manager,
				own.map((review) => review.porterId)
			);
			const now = await this.reviews.now(manager);
			const eligibility = porterReviewEligibility(participation, now);
			return {
				bookingId,
				tripId: participation.tripId,
				serverTime: now,
				completedAt: participation.completedAt,
				...eligibility,
				eligible: eligibility.eligible && porters.length > 0,
				reason:
					eligibility.reason ??
					(porters.length ? null : PorterReviewIneligibleReason.NO_ELIGIBLE_ASSIGNMENT),
				porters: porters.map((porter) => ({
					...porter,
					canCreate:
						eligibility.eligible && !own.some((review) => review.porterId === porter.porterId),
				})),
				reviews: own.map((review) => ({
					...review,
					porterName:
						names.find((porter) => porter.porterId === review.porterId)?.porterName ?? null,
					canEdit: canEditPorterReview(participation, review, now),
				})),
			};
		});
	}

	create(
		userId: string,
		bookingId: string,
		dto: CreatePorterReviewDto
	): Promise<PorterReviewRecord> {
		return this.dataSource.transaction(async (manager) => {
			const participation = await this.requireParticipation(manager, userId, bookingId);
			const assigned = await this.reviews.assignedPorters(manager, participation.tripId);
			const porter = assigned.find((candidate) => candidate.porterId === dto.porterId);
			if (!porter) return this.notFound();
			// Check the wall clock after all lock waits, not the transaction's start timestamp.
			const now = await this.reviews.now(manager);
			const eligibility = porterReviewEligibility(participation, now);
			if (!eligibility.eligible || !eligibility.expiresAt)
				throw new ConflictException({
					code: eligibility.reason,
					message: "Review is not available",
				});
			const review: PorterReviewRecord = {
				id: randomUUID(),
				bookingId,
				memberId: participation.memberId,
				reviewerId: userId,
				tripId: participation.tripId,
				porterId: porter.porterId,
				rating: dto.rating,
				comment: dto.comment?.trim() || null,
				revision: 1,
				moderationStatus: "visible",
				editExpiresAt: eligibility.expiresAt,
				createdAt: now,
				updatedAt: now,
			};
			if (!(await this.reviews.insert(manager, review)))
				throw new ConflictException({
					code: "DUPLICATE_REVIEW",
					message: "A review already exists",
				});
			await this.reviews.recordRevision(manager, review);
			await this.audit(manager, review, null);
			return review;
		});
	}

	update(
		userId: string,
		reviewId: string,
		dto: UpdatePorterReviewDto
	): Promise<PorterReviewRecord> {
		return this.dataSource.transaction(async (manager) => {
			const initial = await this.reviews.findOwn(manager, userId, reviewId);
			if (!initial) return this.notFound();
			// Consistent lock order: participation, then review. Assignment is intentionally not rechecked.
			const participation = await this.requireParticipation(manager, userId, initial.bookingId);
			const current = await this.reviews.findOwn(manager, userId, reviewId, true);
			if (!current) return this.notFound();
			const now = await this.reviews.now(manager);
			if (!canEditPorterReview(participation, current, now))
				throw new ConflictException({
					code: "REVIEW_EDIT_CLOSED",
					message: "Review edit window closed",
				});
			if (current.revision !== dto.expectedRevision)
				throw new ConflictException({
					code: "STALE_REVISION",
					message: "Reload the review before editing",
				});
			const updated = {
				...current,
				rating: dto.rating,
				comment: dto.comment === undefined ? current.comment : dto.comment?.trim() || null,
				revision: current.revision + 1,
				updatedAt: now,
			};
			await this.reviews.update(manager, updated);
			await this.reviews.recordRevision(manager, updated);
			await this.audit(manager, updated, current.revision);
			return updated;
		});
	}

	private async requireParticipation(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<PorterReviewParticipation> {
		const participation = await this.reviews.participation(manager, userId, bookingId);
		if (!participation) return this.notFound();
		return participation;
	}

	private notFound(): never {
		throw new NotFoundException({
			code: "PORTER_REVIEW_NOT_FOUND",
			message: "Review context not found",
		});
	}

	private async audit(
		manager: EntityManager,
		review: PorterReviewRecord,
		previousRevision: number | null
	): Promise<void> {
		await manager.getRepository(AuditLog).save({
			actorId: review.reviewerId,
			action: previousRevision === null ? "porter_review.created" : "porter_review.updated",
			targetType: "porter_review",
			targetId: review.id,
			before: previousRevision === null ? null : { revision: previousRevision },
			after: { revision: review.revision, porterId: review.porterId },
			reason: null,
		});
	}
}
