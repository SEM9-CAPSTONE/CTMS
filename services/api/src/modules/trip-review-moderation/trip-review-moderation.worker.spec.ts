import type { ConfigService } from "@nestjs/config";
import type { DataSource, EntityManager } from "typeorm";
import { InAppNotificationType } from "../in-app-notifications/in-app-notification.entity";
import type { InAppNotificationsService } from "../in-app-notifications/in-app-notifications.service";
import type { TripReviewImageStorageService } from "./trip-review-image-storage.service";
import type { TripReviewModerationProvider } from "./trip-review-moderation.provider";
import { TripReviewModerationWorker } from "./trip-review-moderation.worker";

function createHarness() {
	const managerQuery = jest.fn();
	const dataSourceQuery = jest.fn();
	const manager = { query: managerQuery } as unknown as EntityManager;
	const dataSource = {
		query: dataSourceQuery,
		transaction: jest.fn(async <T>(cb: (em: EntityManager) => Promise<T>) => cb(manager)),
	} as unknown as DataSource;

	const provider = {
		configuration: jest.fn(() => ({
			provider: "gemini",
			model: "gemini-3.1-flash-lite",
			configVersion: "gemini-v1",
			promptVersion: "v1",
		})),
		scanReview: jest.fn(),
	} as unknown as TripReviewModerationProvider;

	const configService = {
		get: jest.fn(() => "false"),
	} as unknown as ConfigService;

	const imageStorage = {
		quarantineImages: jest.fn().mockResolvedValue(true),
		restoreImages: jest.fn().mockResolvedValue(true),
	} as unknown as TripReviewImageStorageService;

	const notifications = {
		enqueueTripReviewModeration: jest.fn().mockResolvedValue(undefined),
	} as unknown as InAppNotificationsService;

	const worker = new TripReviewModerationWorker(
		dataSource,
		provider,
		configService,
		imageStorage,
		notifications
	);

	return {
		worker,
		managerQuery,
		dataSourceQuery,
		provider,
		imageStorage,
		notifications,
	};
}

describe("TripReviewModerationWorker", () => {
	const outboxId = "11111111-1111-4111-8111-111111111111";
	const reviewId = "22222222-2222-4222-8222-222222222222";
	const tripId = "33333333-3333-4333-8333-333333333333";
	const hostId = "44444444-4444-4444-8444-444444444444";
	const runId = "55555555-5555-4555-8555-555555555555";

	function mockOutboxClaimAndRevision(
		harness: ReturnType<typeof createHarness>,
		opts: {
			sourceRevision?: number;
			currentRevision?: number;
			comment?: string | null;
			images?: string[];
			moderationStatus?: "visible" | "hidden";
			hiddenSource?: "ai" | "host" | "admin" | null;
			hostDecision?: string | null;
			adminActioned?: boolean;
		} = {}
	) {
		const sourceRevision = opts.sourceRevision ?? 1;
		const currentRevision = opts.currentRevision ?? sourceRevision;

		harness.dataSourceQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("FROM trip_review_revisions")) {
				return [{ comment: opts.comment ?? "Chuyến đi bình thường", images: opts.images ?? [] }];
			}
			return [];
		});

		harness.managerQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("FROM trip_review_moderation_outbox")) {
				return [
					{
						id: outboxId,
						reviewId,
						sourceRevision,
						configVersion: "gemini-v1",
						createdAt: new Date(),
						processedAt: null,
					},
				];
			}
			if (sql.includes("INSERT INTO trip_review_moderation_runs")) {
				return [{ id: runId, attempts: 1 }];
			}
			if (sql.includes("FROM trip_reviews") && sql.includes("FOR UPDATE")) {
				return [
					{
						revision: currentRevision,
						tripId,
						hostId,
						moderationStatus: opts.moderationStatus ?? "visible",
						hiddenSource: opts.hiddenSource ?? null,
						images: opts.images ?? [],
						imageStorageState: "live",
					},
				];
			}
			if (sql.includes("FROM trip_review_moderation_decisions")) {
				return opts.hostDecision ? [{ decision: opts.hostDecision }] : [];
			}
			if (sql.includes("UPDATE trip_review_moderation_runs")) {
				return [[], 1];
			}
			if (sql.includes("FROM content_reports")) {
				return opts.adminActioned ? [{ id: "report-1" }] : [];
			}
			return [];
		});
	}

	it("auto-hides review, quarantines images, and notifies host when confidence > 0.80 (0.81)", async () => {
		const harness = createHarness();
		mockOutboxClaimAndRevision(harness, {
			images: ["/uploads/trip-reviews/img1.jpg"],
		});
		(harness.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "completed",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [
				{
					flag_type: "profanity_or_insult",
					confidence: 0.81,
					evidence: "Ngôn từ xúc phạm",
					quote: "đồ ngu",
				},
			],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		const result = await harness.worker.processOutboxRecord(outboxId);
		expect(result).toBe(true);

		const hideCall = harness.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'hidden'")
		);
		expect(hideCall).toBeDefined();
		expect(hideCall?.[1]).toEqual(["profanity_or_insult", 1, "quarantine_pending", reviewId]);

		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tripId,
				reviewId,
				eventType: InAppNotificationType.REVIEW_AUTO_HIDDEN,
				sourceKey: `review-moderation:auto-hidden:${reviewId}:rev:1`,
			})
		);
		expect(harness.imageStorage.quarantineImages).toHaveBeenCalledWith([
			"/uploads/trip-reviews/img1.jpg",
		]);
	});

	it("keeps review visible and notifies host when confidence is exactly 0.80", async () => {
		const harness = createHarness();
		mockOutboxClaimAndRevision(harness);
		(harness.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "not_applicable",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [
				{
					flag_type: "profanity_or_insult",
					confidence: 0.8,
					evidence: "Từ ngữ nặng nề",
					quote: "tệ quá",
				},
			],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		const result = await harness.worker.processOutboxRecord(outboxId);
		expect(result).toBe(true);

		const hideCall = harness.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'hidden'")
		);
		expect(hideCall).toBeUndefined();
		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				eventType: InAppNotificationType.REVIEW_MODERATION_FLAGGED,
				sourceKey: `review-moderation:flagged:${reviewId}:rev:1`,
			})
		);
	});

	it("does not re-hide review if Host already restored the same revision", async () => {
		const harness = createHarness();
		mockOutboxClaimAndRevision(harness, { hostDecision: "restore" });
		(harness.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "not_applicable",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [
				{
					flag_type: "harassment",
					confidence: 0.95,
					evidence: "Cờ cũ",
					quote: "test",
				},
			],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		const result = await harness.worker.processOutboxRecord(outboxId);
		expect(result).toBe(true);

		const hideCall = harness.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'hidden'")
		);
		expect(hideCall).toBeUndefined();
		expect(harness.notifications.enqueueTripReviewModeration).not.toHaveBeenCalled();
	});

	it("does not overwrite newer revision when Camper edited while AI was scanning", async () => {
		const harness = createHarness();
		mockOutboxClaimAndRevision(harness, { sourceRevision: 1, currentRevision: 2 });
		(harness.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "not_applicable",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [
				{
					flag_type: "harassment",
					confidence: 0.95,
					evidence: "Bản cũ",
					quote: "test",
				},
			],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		const result = await harness.worker.processOutboxRecord(outboxId);
		expect(result).toBe(true);

		const hideCall = harness.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'hidden'")
		);
		expect(hideCall).toBeUndefined();
		expect(harness.notifications.enqueueTripReviewModeration).not.toHaveBeenCalled();
	});

	it("auto-restores AI-hidden review on clean re-scan unless Admin actioned report exists", async () => {
		const harnessClean = createHarness();
		mockOutboxClaimAndRevision(harnessClean, {
			moderationStatus: "hidden",
			hiddenSource: "ai",
			adminActioned: false,
			images: ["/uploads/trip-reviews/clean.jpg"],
		});
		(harnessClean.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "completed",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		await harnessClean.worker.processOutboxRecord(outboxId);
		const restoreCall = harnessClean.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'visible'")
		);
		expect(restoreCall).toBeDefined();
		expect(harnessClean.imageStorage.restoreImages).toHaveBeenCalledWith([
			"/uploads/trip-reviews/clean.jpg",
		]);

		// Admin actioned override case
		const harnessAdmin = createHarness();
		mockOutboxClaimAndRevision(harnessAdmin, {
			moderationStatus: "hidden",
			hiddenSource: "ai",
			adminActioned: true,
		});
		(harnessAdmin.provider.scanReview as jest.Mock).mockResolvedValue({
			text_scan_status: "completed",
			image_scan_status: "not_applicable",
			aspects_status: "completed",
			incidents_status: "completed",
			flags: [],
			image_items: [],
			aspect_sentiments: [],
			incident_signals: [],
		});

		await harnessAdmin.worker.processOutboxRecord(outboxId);
		const blockedRestoreCall = harnessAdmin.managerQuery.mock.calls.find(
			([sql]) => typeof sql === "string" && sql.includes("SET moderation_status = 'visible'")
		);
		expect(blockedRestoreCall).toBeUndefined();
	});

	it("marks stuck/failed reviews as unverified after 15 minutes and notifies Host", async () => {
		const harness = createHarness();
		harness.dataSourceQuery.mockResolvedValue([{ reviewId, tripId, revision: 1 }]);
		harness.managerQuery.mockResolvedValue([]);

		const count = await harness.worker.processUnverifiedTimeouts(new Date("2026-11-20T01:00:00Z"));
		expect(count).toBe(1);
		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tripId,
				reviewId,
				eventType: InAppNotificationType.REVIEW_MODERATION_UNVERIFIED,
				sourceKey: `review-moderation:unverified:${reviewId}:rev:1`,
			})
		);
	});

	it("escalates unresolved <= 80% reviews after 7 days to Host reminder and Admin escalation", async () => {
		const harness = createHarness();
		harness.dataSourceQuery.mockResolvedValue([{ reviewId, tripId, revision: 1 }]);
		harness.managerQuery.mockResolvedValue([]);

		const count = await harness.worker.processHostModerationSlaEscalations(
			new Date("2026-11-20T01:00:00Z")
		);
		expect(count).toBe(1);
		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenCalledTimes(2);
		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			expect.objectContaining({
				eventType: InAppNotificationType.REVIEW_MODERATION_REMINDER,
				sourceKey: `review-moderation:sla-reminder:${reviewId}:rev:1`,
			})
		);
		expect(harness.notifications.enqueueTripReviewModeration).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			expect.objectContaining({
				eventType: InAppNotificationType.REVIEW_MODERATION_ESCALATED,
				sourceKey: `review-moderation:sla-escalated:${reviewId}:rev:1`,
			})
		);
	});
});
