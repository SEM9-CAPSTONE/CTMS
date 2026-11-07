import type { EntityManager } from "typeorm";
import { TripReviewModerationOutboxService } from "./trip-review-moderation-outbox.service";
import { MODERATION_DEFAULT_CONFIG_VERSION } from "./trip-review-moderation.constants";

describe("TripReviewModerationOutboxService", () => {
	let service: TripReviewModerationOutboxService;
	let mockEntityManager: jest.Mocked<EntityManager>;

	beforeEach(() => {
		process.env.REVIEW_MODERATION_CONFIG_VERSION = "gemini-v1";
		service = new TripReviewModerationOutboxService();
		mockEntityManager = {
			query: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<EntityManager>;
	});

	afterEach(() => {
		// biome-ignore lint/performance/noDelete: assigning undefined creates a literal environment string
		delete process.env.REVIEW_MODERATION_CONFIG_VERSION;
		jest.clearAllMocks();
	});

	describe("onReviewCreated", () => {
		it("enqueues outbox entry when review has non-empty comment", async () => {
			await service.onReviewCreated(mockEntityManager, {
				id: "review-1",
				revision: 1,
				comment: "Chuyến đi tuyệt vời!",
				images: [],
			});

			expect(mockEntityManager.query).toHaveBeenCalledTimes(1);
			expect(mockEntityManager.query).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO trip_review_moderation_outbox"),
				["review-1", 1, "gemini-v1"]
			);
		});

		it("enqueues outbox entry when review has images even if comment is null", async () => {
			await service.onReviewCreated(mockEntityManager, {
				id: "review-2",
				revision: 1,
				comment: null,
				images: ["uploads/review-img.jpg"],
			});

			expect(mockEntityManager.query).toHaveBeenCalledTimes(1);
			expect(mockEntityManager.query).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO trip_review_moderation_outbox"),
				["review-2", 1, "gemini-v1"]
			);
		});

		it("does not enqueue when review has empty comment and no images", async () => {
			await service.onReviewCreated(mockEntityManager, {
				id: "review-3",
				revision: 1,
				comment: "   ",
				images: [],
			});

			expect(mockEntityManager.query).not.toHaveBeenCalled();
		});

		it("falls back to MODERATION_DEFAULT_CONFIG_VERSION if env not set", async () => {
			// biome-ignore lint/performance/noDelete: assigning undefined creates a literal environment string
			delete process.env.REVIEW_MODERATION_CONFIG_VERSION;
			const defaultService = new TripReviewModerationOutboxService();

			await defaultService.onReviewCreated(mockEntityManager, {
				id: "review-4",
				revision: 1,
				comment: "Good trip",
			});

			expect(mockEntityManager.query).toHaveBeenCalledWith(expect.any(String), [
				"review-4",
				1,
				MODERATION_DEFAULT_CONFIG_VERSION,
			]);
		});
	});

	describe("onReviewUpdated", () => {
		it("supersedes existing active flags and enqueues new revision if eligible", async () => {
			await service.onReviewUpdated(mockEntityManager, {
				id: "review-1",
				revision: 2,
				comment: "Đã sửa lại đánh giá",
				images: ["new-img.jpg"],
			});

			expect(mockEntityManager.query).toHaveBeenCalledTimes(2);

			// First query: supersede active flags
			expect(mockEntityManager.query).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("UPDATE trip_review_moderation_flags"),
				["review-1"]
			);

			// Second query: insert outbox for revision 2
			expect(mockEntityManager.query).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("INSERT INTO trip_review_moderation_outbox"),
				["review-1", 2, "gemini-v1"]
			);
		});

		it("supersedes existing active flags even if new revision is empty and not enqueued", async () => {
			await service.onReviewUpdated(mockEntityManager, {
				id: "review-1",
				revision: 2,
				comment: "",
				images: [],
			});

			expect(mockEntityManager.query).toHaveBeenCalledTimes(1);
			expect(mockEntityManager.query).toHaveBeenCalledWith(
				expect.stringContaining("UPDATE trip_review_moderation_flags"),
				["review-1"]
			);
		});
	});
});
