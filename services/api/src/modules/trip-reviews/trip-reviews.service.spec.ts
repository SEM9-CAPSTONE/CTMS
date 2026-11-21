import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import type { TripReviewModerationOutboxService } from "../trip-review-moderation/trip-review-moderation-outbox.service";
import type { TripReviewsRepository } from "./trip-reviews.repository";
import { TripReviewsService } from "./trip-reviews.service";
import {
	type ReviewParticipation,
	ReviewTarget,
	type TripReviewRecord,
} from "./trip-reviews.types";

const now = new Date("2026-11-04T01:00:00Z");
const participation: ReviewParticipation = {
	bookingId: "booking",
	memberId: "member",
	reviewerId: "camper",
	tripId: "trip",
	hostId: "host",
	bookingStatus: BookingStatus.COMPLETED,
	memberStatus: BookingMemberStatus.JOINED,
	checkedInAt: new Date("2026-11-03T01:00:00Z"),
	leftAt: null,
	completedAt: new Date("2026-11-04T00:00:00Z"),
};
const review: TripReviewRecord = {
	id: "review",
	bookingId: "booking",
	memberId: "member",
	reviewerId: "camper",
	tripId: "trip",
	hostId: "host",
	target: ReviewTarget.TRIP,
	targetId: "trip",
	rating: 2,
	comment: "Original",
	images: [],
	revision: 1,
	createdAt: now,
	updatedAt: now,
};

describe("TripReviewsService", () => {
	const saveAudit = jest.fn();
	const manager = {
		getRepository: jest.fn(() => ({ save: saveAudit })),
	} as unknown as EntityManager;
	const repository = {
		participation: jest.fn(),
		now: jest.fn(),
		listOwn: jest.fn(),
		find: jest.fn(),
		insert: jest.fn(),
		update: jest.fn(),
		recordRevision: jest.fn(),
	};
	let service: TripReviewsService;
	beforeEach(() => {
		jest.resetAllMocks();
		(manager.getRepository as jest.Mock).mockReturnValue({ save: saveAudit });
		repository.participation.mockResolvedValue(participation);
		repository.now.mockResolvedValue(now);
		repository.listOwn.mockResolvedValue([]);
		repository.find.mockResolvedValue(review);
		repository.insert.mockResolvedValue(true);
		const source = {
			transaction: (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
		} as unknown as DataSource;
		const mockModerationOutbox = {
			onReviewCreated: jest.fn().mockResolvedValue(undefined),
			onReviewUpdated: jest.fn().mockResolvedValue(undefined),
		} as unknown as TripReviewModerationOutboxService;
		service = new TripReviewsService(
			source,
			repository as unknown as TripReviewsRepository,
			mockModerationOutbox
		);
	});
	describe("context", () => {
		it("reports current eligibility and keeps existing own reviews after expiry", async () => {
			repository.now.mockResolvedValue(new Date("2026-11-07T00:00:00Z"));
			repository.listOwn.mockResolvedValue([review]);
			expect(await service.context("camper", "booking")).toMatchObject({
				eligible: false,
				reason: "WINDOW_EXPIRED",
				reviews: [review],
			});
		});
		it("does not expose data for an unlinked participation", async () => {
			repository.participation.mockResolvedValue(null);
			await expect(service.context("outsider", "booking")).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(repository.listOwn).not.toHaveBeenCalled();
		});
	});
	describe("create", () => {
		it.each([ReviewTarget.TRIP, ReviewTarget.HOST])(
			"derives %s identity and records a source revision with minimal audit",
			async (target) => {
				const created = await service.create("camper", "booking", {
					target,
					rating: 5,
					comment: " Feedback ",
				});
				expect(created).toMatchObject({
					reviewerId: "camper",
					targetId: target,
					comment: "Feedback",
					revision: 1,
				});
				expect(repository.recordRevision).toHaveBeenCalledWith(manager, created);
				expect(saveAudit.mock.calls[0][0]).not.toHaveProperty("comment");
			}
		);
		it("rejects duplicates before creating history/audit", async () => {
			repository.insert.mockResolvedValue(false);
			await expect(
				service.create("camper", "booking", { target: ReviewTarget.TRIP, rating: 4 })
			).rejects.toBeInstanceOf(ConflictException);
			expect(repository.recordRevision).not.toHaveBeenCalled();
			expect(saveAudit).not.toHaveBeenCalled();
		});
		it("uses time read after locking, and rejects a request that waited past expiry", async () => {
			repository.now.mockResolvedValue(new Date("2026-11-07T00:00:00Z"));
			await expect(
				service.create("camper", "booking", { target: ReviewTarget.HOST, rating: 4 })
			).rejects.toThrow("WINDOW_EXPIRED");
			expect(repository.insert).not.toHaveBeenCalled();
			expect(repository.participation.mock.invocationCallOrder[0]).toBeLessThan(
				repository.now.mock.invocationCallOrder[0]
			);
		});
	});
	describe("update", () => {
		it.each([23, 24, 25])(
			"checks the edit deadline at %sh from initial submission",
			async (hours) => {
				repository.now.mockResolvedValue(new Date(now.getTime() + hours * 3600000));
				const result = service.update("camper", "review", { expectedRevision: 1, rating: 4 });
				if (hours < 24) await expect(result).resolves.toMatchObject({ rating: 4 });
				else await expect(result).rejects.toBeInstanceOf(ConflictException);
			}
		);
		it("allows editing a late submission after the creation window", async () => {
			const createdAt = new Date(new Date("2026-11-04T00:00:00Z").getTime() + 71 * 3600000);
			repository.find.mockResolvedValue({ ...review, createdAt });
			repository.now.mockResolvedValue(new Date(createdAt.getTime() + 2 * 3600000));
			await expect(
				service.update("camper", "review", { expectedRevision: 1, rating: 4 })
			).resolves.toMatchObject({ rating: 4 });
		});
		it("never renews the edit deadline", async () => {
			repository.find.mockResolvedValue({
				...review,
				revision: 2,
				updatedAt: new Date(now.getTime() + 23 * 3600000),
			});
			repository.now.mockResolvedValue(new Date(now.getTime() + 24 * 3600000));
			await expect(
				service.update("camper", "review", { expectedRevision: 2, rating: 4 })
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("retains identity and increments revision without mutating the old source", async () => {
			const updated = await service.update("camper", "review", { expectedRevision: 1, rating: 5 });
			expect(updated).toEqual({ ...review, revision: 2, rating: 5, comment: null });
			expect(review.comment).toBe("Original");
			expect(repository.recordRevision).toHaveBeenCalledWith(manager, updated);
		});
		it("re-reads after the lock and rejects another request's revision", async () => {
			repository.find
				.mockResolvedValueOnce(review)
				.mockResolvedValueOnce({ ...review, revision: 2 });
			await expect(
				service.update("camper", "review", { expectedRevision: 1, rating: 4 })
			).rejects.toBeInstanceOf(ConflictException);
			expect(repository.update).not.toHaveBeenCalled();
		});
		it("rejects non-owner and missing review", async () => {
			await expect(
				service.update("outsider", "review", { expectedRevision: 1, rating: 4 })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(repository.participation).not.toHaveBeenCalled();
			repository.find.mockResolvedValue(null);
			await expect(
				service.update("camper", "missing", { expectedRevision: 1, rating: 4 })
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("allows editing within 24h of firstHiddenAt even after initial 24h window expired", async () => {
			const hiddenReview = {
				...review,
				createdAt: new Date("2026-11-04T01:00:00Z"),
				moderationStatus: "hidden" as const,
				firstHiddenAt: new Date("2026-11-05T10:00:00Z"),
				hiddenSource: "ai" as const,
			};
			// 43 hours after createdAt, but only 10 hours after firstHiddenAt -> allowed
			repository.now.mockResolvedValue(new Date("2026-11-05T20:00:00Z"));
			repository.find.mockResolvedValue(hiddenReview);

			const updated = await service.update("camper", "review", {
				expectedRevision: 1,
				rating: 4,
				comment: "Đã chỉnh sửa lịch sự hơn",
			});
			expect(updated.revision).toBe(2);
			expect(repository.update).toHaveBeenCalled();
		});

		it("rejects editing once 24h supplementary window from firstHiddenAt has expired", async () => {
			const expiredHiddenReview = {
				...review,
				createdAt: new Date("2026-11-04T01:00:00Z"),
				moderationStatus: "hidden" as const,
				firstHiddenAt: new Date("2026-11-05T10:00:00Z"),
				hiddenSource: "ai" as const,
			};
			// 25 hours after firstHiddenAt -> expired
			repository.now.mockResolvedValue(new Date("2026-11-06T11:00:00Z"));
			repository.find.mockResolvedValue(expiredHiddenReview);

			await expect(
				service.update("camper", "review", {
					expectedRevision: 1,
					rating: 4,
					comment: "Quá hạn sửa bổ sung",
				})
			).rejects.toBeInstanceOf(ConflictException);
			expect(repository.update).not.toHaveBeenCalled();
		});

		it("distinguishes AI auto-hide notice from host manual hide notice in context()", async () => {
			repository.listOwn.mockResolvedValue([
				{
					...review,
					moderationStatus: "hidden",
					hiddenReason: "profanity_or_insult",
					hiddenSource: "ai",
					firstHiddenAt: new Date("2026-11-04T02:00:00Z"),
				},
			]);

			const ctx = await service.context("camper", "booking");
			expect(ctx.reviews[0].moderationNotice).toContain("Hệ thống đã tự động ẩn");
			expect(ctx.reviews[0].hiddenSource).toBe("ai");
		});
	});
});
