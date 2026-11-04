import { randomUUID } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { TripReviewContextResponseDto } from "./dto/trip-review-response.dto";
import type { CreateTripReviewDto, UpdateTripReviewDto } from "./dto/trip-review.dto";
import { reviewEligibility } from "./trip-reviews.policy";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { TripReviewsRepository } from "./trip-reviews.repository";
import {
	type ReviewParticipation,
	ReviewTarget,
	type TripReviewRecord,
} from "./trip-reviews.types";

@Injectable()
export class TripReviewsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly reviews: TripReviewsRepository
	) {}

	context(userId: string, bookingId: string): Promise<TripReviewContextResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const participation = await this.requireParticipation(manager, userId, bookingId);
			const now = await this.reviews.now(manager);
			return {
				bookingId,
				tripId: participation.tripId,
				hostId: participation.hostId,
				completedAt: participation.completedAt,
				serverTime: now,
				...reviewEligibility(participation, now),
				reviews: await this.reviews.listOwn(manager, userId, bookingId),
			};
		});
	}

	create(userId: string, bookingId: string, dto: CreateTripReviewDto): Promise<TripReviewRecord> {
		return this.dataSource.transaction(async (manager) => {
			const participation = await this.requireParticipation(manager, userId, bookingId);
			const now = await this.reviews.now(manager);
			this.assertEligible(participation, now);
			const review: TripReviewRecord = {
				id: randomUUID(),
				bookingId,
				memberId: participation.memberId,
				reviewerId: userId,
				tripId: participation.tripId,
				hostId: participation.hostId,
				target: dto.target,
				targetId: dto.target === ReviewTarget.TRIP ? participation.tripId : participation.hostId,
				rating: dto.rating,
				comment: dto.comment?.trim() || null,
				revision: 1,
				createdAt: now,
				updatedAt: now,
			};
			if (!(await this.reviews.insert(manager, review)))
				throw new ConflictException("A review already exists for this participation and target");
			await this.reviews.recordRevision(manager, review);
			await this.audit(manager, userId, review, null);
			return review;
		});
	}

	update(userId: string, reviewId: string, dto: UpdateTripReviewDto): Promise<TripReviewRecord> {
		return this.dataSource.transaction(async (manager) => {
			const initial = await this.reviews.find(manager, reviewId);
			if (!initial) throw new NotFoundException("Review not found");
			if (initial.reviewerId !== userId)
				throw new ForbiddenException("Only the review owner may edit this review");
			const participation = await this.requireParticipation(manager, userId, initial.bookingId);
			// Re-read after the participation lock so a concurrent edit cannot use an old revision.
			const current = await this.reviews.find(manager, reviewId);
			if (!current) throw new NotFoundException("Review not found");
			const now = await this.reviews.now(manager);
			this.assertEligible(participation, now);
			if (current.revision !== dto.expectedRevision)
				throw new ConflictException("Review has changed; reload before editing");
			const updated = {
				...current,
				rating: dto.rating,
				comment: dto.comment?.trim() || null,
				revision: current.revision + 1,
				updatedAt: now,
			};
			await this.reviews.update(manager, updated);
			await this.reviews.recordRevision(manager, updated);
			await this.audit(manager, userId, updated, current.revision);
			return updated;
		});
	}

	private async requireParticipation(
		manager: EntityManager,
		userId: string,
		bookingId: string
	): Promise<ReviewParticipation> {
		const participation = await this.reviews.participation(manager, userId, bookingId);
		if (!participation) throw new ForbiddenException("No linked participation for this Booking");
		return participation;
	}

	private assertEligible(participation: ReviewParticipation, now: Date): void {
		const eligibility = reviewEligibility(participation, now);
		if (!eligibility.eligible)
			throw new ConflictException(eligibility.reason ?? "Review unavailable");
	}

	private async audit(
		manager: EntityManager,
		userId: string,
		review: TripReviewRecord,
		previousRevision: number | null
	): Promise<void> {
		// Content stays in revisions; audit records only identities/versions, not private comments.
		await manager.getRepository(AuditLog).save({
			actorId: userId,
			action: previousRevision === null ? "trip_review.created" : "trip_review.updated",
			targetType: "trip_review",
			targetId: review.id,
			before: previousRevision === null ? null : { revision: previousRevision },
			after: { revision: review.revision, target: review.target, targetId: review.targetId },
			reason: null,
		});
	}
}
