import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
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
		service = new TripReviewsService(source, repository as unknown as TripReviewsRepository);
	});
	describe("context", () => {
		it("reports current eligibility and keeps existing own reviews after expiry", async () => {
			repository.now.mockResolvedValue(new Date("2026-11-05T00:00:00Z"));
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
			repository.now.mockResolvedValue(new Date("2026-11-05T00:00:00Z"));
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
	});
});
