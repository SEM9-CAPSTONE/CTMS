import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { ModerationDecisionAction } from "./dtos/create-moderation-decision.dto";
import { ModerationQueueStatusFilter } from "./dtos/get-host-moderation-queue-query.dto";
import type { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import { TripReviewModerationHostService } from "./trip-review-moderation-host.service";
import type { ModerationFlagType } from "./trip-review-moderation.types";

describe("TripReviewModerationHostService", () => {
	let service: TripReviewModerationHostService;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockImageStorage: jest.Mocked<TripReviewImageStorageService>;
	let mockManager: jest.Mocked<EntityManager>;
	const saveAudit = jest.fn();

	beforeEach(() => {
		mockManager = {
			query: jest.fn(),
		} as unknown as jest.Mocked<EntityManager>;

		mockDataSource = {
			query: jest.fn(),
			transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager)),
			getRepository: jest.fn(() => ({ save: saveAudit })),
		} as unknown as jest.Mocked<DataSource>;

		mockImageStorage = {
			extractFilename: jest.fn((url: string) => url.split("/").pop() ?? null),
			quarantineImages: jest.fn().mockResolvedValue(true),
			restoreImages: jest.fn().mockResolvedValue(true),
			getQuarantinedPath: jest.fn(
				(url: string) => `/uploads/quarantine/trip-reviews/${url.split("/").pop()}`
			),
		} as unknown as jest.Mocked<TripReviewImageStorageService>;

		service = new TripReviewModerationHostService(mockDataSource, mockImageStorage);
		saveAudit.mockReset();
	});

	describe("getQueue", () => {
		it("returns queue items and total count", async () => {
			mockDataSource.query
				.mockResolvedValueOnce([{ count: "1" }])
				.mockResolvedValueOnce([
					{
						id: "rev-1",
						tripId: "trip-1",
						tripTitle: "Mount Fansipan Trek",
						reviewerId: "camper-1",
						hostId: "host-1",
						rating: 1,
						comment: "Tệ quá",
						images: ["/uploads/trip-reviews/img1.jpg"],
						revision: 1,
						createdAt: new Date("2026-11-01"),
						moderationStatus: "visible",
						imageStorageState: "live",
						hiddenReason: null,
					},
				])
				.mockResolvedValueOnce([
					{
						id: "flag-1",
						reviewId: "rev-1",
						flagType: "profanity_or_insult" as ModerationFlagType,
						channel: "text",
						detectionSource: "model",
						confidence: 0.95,
						evidence: "Chứa từ ngữ xúc phạm",
						quote: "Tệ quá",
						targetImageIndex: null,
						createdAt: new Date("2026-11-01"),
					},
				]);

			const result = await service.getQueue("host-1", {
				page: 1,
				limit: 10,
				status: ModerationQueueStatusFilter.PENDING_REVIEW,
			});

			expect(result.total).toBe(1);
			expect(result.items.length).toBe(1);
			expect(result.items[0].reviewId).toBe("rev-1");
			expect(result.items[0].activeFlags.length).toBe(1);
			expect(result.items[0].activeFlags[0].flagType).toBe("profanity_or_insult");
		});

		it("returns empty items when count is 0", async () => {
			mockDataSource.query.mockResolvedValueOnce([{ count: "0" }]).mockResolvedValueOnce([]);

			const result = await service.getQueue("host-1", {});
			expect(result.total).toBe(0);
			expect(result.items).toEqual([]);
		});
	});

	describe("recordDecision", () => {
		const baseReview = {
			id: "rev-1",
			tripId: "trip-1",
			tripTitle: "Mount Fansipan Trek",
			reviewerId: "camper-1",
			hostId: "host-1",
			rating: 1,
			comment: "Xúc phạm",
			images: ["/uploads/trip-reviews/pic.jpg"],
			revision: 1,
			createdAt: new Date(),
			moderationStatus: "visible",
			imageStorageState: "live",
			hiddenReason: null,
		};

		it("throws NotFoundException when review does not exist", async () => {
			mockManager.query.mockResolvedValueOnce([]);

			await expect(
				service.recordDecision("host-1", "rev-non-existent", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.KEEP,
				})
			).rejects.toThrow(NotFoundException);
		});

		it("throws ForbiddenException when user is not the host of the trip", async () => {
			mockManager.query.mockResolvedValueOnce([baseReview]);

			await expect(
				service.recordDecision("different-host", "rev-1", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.KEEP,
				})
			).rejects.toThrow(ForbiddenException);
		});

		it("throws ConflictException when expectedRevision does not match current revision", async () => {
			mockManager.query.mockResolvedValueOnce([baseReview]);

			await expect(
				service.recordDecision("host-1", "rev-1", {
					expectedRevision: 2, // Mismatch (rev is 1)
					decision: ModerationDecisionAction.KEEP,
				})
			).rejects.toThrow(ConflictException);
		});

		describe("decision: HIDE", () => {
			it("throws BadRequestException when reason does not match active flag", async () => {
				mockManager.query
					.mockResolvedValueOnce([baseReview])
					.mockResolvedValueOnce([{ flag_type: "profanity_or_insult" }]);

				await expect(
					service.recordDecision("host-1", "rev-1", {
						expectedRevision: 1,
						decision: ModerationDecisionAction.HIDE,
						reason: "spam_or_irrelevant" as ModerationFlagType, // Active is profanity
					})
				).rejects.toThrow(BadRequestException);
			});

			it("successfully hides review, quarantines images, and updates storage state", async () => {
				mockManager.query
					.mockResolvedValueOnce([baseReview])
					.mockResolvedValueOnce([{ flag_type: "profanity_or_insult" }]) // active flag matches
					.mockResolvedValueOnce([]) // resolve flags UPDATE
					.mockResolvedValueOnce([{ id: "decision-1", created_at: new Date() }]) // INSERT decision
					.mockResolvedValueOnce([]); // UPDATE trip_reviews

				mockDataSource.query.mockResolvedValueOnce([]); // UPDATE final image_storage_state

				const result = await service.recordDecision("host-1", "rev-1", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.HIDE,
					reason: "profanity_or_insult" as ModerationFlagType,
					note: "Vi phạm quy chuẩn",
				});

				expect(result.decision).toBe("hide");
				expect(result.moderationStatus).toBe("hidden");
				expect(result.imageStorageState).toBe("quarantined");
				expect(mockImageStorage.quarantineImages).toHaveBeenCalledWith([
					"/uploads/trip-reviews/pic.jpg",
				]);
			});
		});

		describe("decision: KEEP", () => {
			it("successfully resolves flags and keeps review visible", async () => {
				mockManager.query
					.mockResolvedValueOnce([baseReview])
					.mockResolvedValueOnce([]) // resolve flags UPDATE
					.mockResolvedValueOnce([{ id: "decision-2", created_at: new Date() }]); // INSERT decision

				const result = await service.recordDecision("host-1", "rev-1", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.KEEP,
					note: "Review hợp lệ",
				});

				expect(result.decision).toBe("keep");
				expect(result.moderationStatus).toBe("visible");
				expect(mockImageStorage.quarantineImages).not.toHaveBeenCalled();
			});
		});

		describe("decision: RESTORE", () => {
			it("remains hidden with adminActionedOverride when actioned content report exists", async () => {
				const hiddenReview = {
					...baseReview,
					moderationStatus: "hidden",
					imageStorageState: "quarantined",
					hiddenReason: "profanity_or_insult",
				};

				mockManager.query
					.mockResolvedValueOnce([hiddenReview])
					.mockResolvedValueOnce([{ id: "report-admin-actioned" }]) // Admin report found!
					.mockResolvedValueOnce([{ id: "decision-3", created_at: new Date() }]); // INSERT decision

				const result = await service.recordDecision("host-1", "rev-1", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.RESTORE,
					note: "Tôi muốn khôi phục",
				});

				expect(result.decision).toBe("restore");
				expect(result.moderationStatus).toBe("hidden");
				expect(result.adminActionedOverride).toBe(true);
				expect(mockImageStorage.restoreImages).not.toHaveBeenCalled();
			});

			it("successfully restores review to visible when no actioned content report", async () => {
				const hiddenReview = {
					...baseReview,
					moderationStatus: "hidden",
					imageStorageState: "quarantined",
					hiddenReason: "profanity_or_insult",
				};

				mockManager.query
					.mockResolvedValueOnce([hiddenReview])
					.mockResolvedValueOnce([]) // No Admin report
					.mockResolvedValueOnce([{ id: "decision-4", created_at: new Date() }]) // INSERT decision
					.mockResolvedValueOnce([]); // UPDATE trip_reviews

				mockDataSource.query.mockResolvedValueOnce([]); // UPDATE final image_storage_state

				const result = await service.recordDecision("host-1", "rev-1", {
					expectedRevision: 1,
					decision: ModerationDecisionAction.RESTORE,
				});

				expect(result.decision).toBe("restore");
				expect(result.moderationStatus).toBe("visible");
				expect(result.adminActionedOverride).toBe(false);
				expect(mockImageStorage.restoreImages).toHaveBeenCalledWith([
					"/uploads/trip-reviews/pic.jpg",
				]);
			});
		});
	});

	describe("getQuarantinedImageFile", () => {
		const baseReview = {
			id: "rev-1",
			hostId: "host-1",
			images: ["/uploads/trip-reviews/pic1.jpg"],
			imageStorageState: "quarantined",
		};

		it("throws NotFoundException if review not found", async () => {
			mockDataSource.query.mockResolvedValueOnce([]);

			await expect(service.getQuarantinedImageFile("host-1", "non-existent", 0)).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if host does not own review", async () => {
			mockDataSource.query.mockResolvedValueOnce([baseReview]);

			await expect(service.getQuarantinedImageFile("other-host", "rev-1", 0)).rejects.toThrow(
				ForbiddenException
			);
		});

		it("throws ConflictException if image operation is pending", async () => {
			mockDataSource.query.mockResolvedValueOnce([
				{ ...baseReview, imageStorageState: "quarantine_pending" },
			]);

			await expect(service.getQuarantinedImageFile("host-1", "rev-1", 0)).rejects.toThrow(
				ConflictException
			);
		});

		it("throws NotFoundException if image index out of bounds", async () => {
			mockDataSource.query.mockResolvedValueOnce([baseReview]);

			await expect(service.getQuarantinedImageFile("host-1", "rev-1", 5)).rejects.toThrow(
				NotFoundException
			);
		});

		it("returns file path, filename, and records audit log", async () => {
			mockDataSource.query.mockResolvedValueOnce([baseReview]);

			const result = await service.getQuarantinedImageFile("host-1", "rev-1", 0);

			expect(result.filePath).toBe("/uploads/quarantine/trip-reviews/pic1.jpg");
			expect(result.filename).toBe("pic1.jpg");
			expect(saveAudit).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: "host-1",
					action: "trip_review_image.view_quarantined",
					targetType: "trip_review",
					targetId: "rev-1",
				})
			);
		});
	});
});
