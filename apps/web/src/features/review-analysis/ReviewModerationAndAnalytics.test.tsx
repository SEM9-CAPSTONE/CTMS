import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import { ModerationDecisionDialog } from "./ModerationDecisionDialog";
import { ModerationQueueTable } from "./ModerationQueueTable";
import { QuarantinedImageModal } from "./QuarantinedImageModal";
import { RouteSafetyDashboard } from "./RouteSafetyDashboard";
import { TripFeedbackDashboard } from "./TripFeedbackDashboard";
import { analysisService } from "./service";
import type {
	ModerationQueueItem,
	ModerationQueueResponse,
	RouteSafetyOverviewResponse,
	TripFeedbackOverviewResponse,
} from "./types";

vi.mock("./service", () => ({
	analysisService: {
		trips: vi.fn(),
		insights: vi.fn(),
		batch: vi.fn(),
		create: vi.fn(),
		source: vi.fn(),
		moderationQueue: vi.fn(),
		recordDecision: vi.fn(),
		getQuarantinedImageBlob: vi.fn(),
		tripFeedbackOverview: vi.fn(),
		routeSafetyOverview: vi.fn(),
	},
}));

const mockService = vi.mocked(analysisService);

const sampleQueueItem: ModerationQueueItem = {
	reviewId: "rev-123",
	tripId: "trip-456",
	tripTitle: "Trekking Bạch Mộc Lương Tử",
	reviewerId: "user-789",
	rating: 2,
	comment: "Đường dốc nguy hiểm và người dẫn đoàn vô trách nhiệm",
	images: ["/uploads/trip-reviews/flagged-img.jpg"],
	sourceRevision: 1,
	createdAt: "2026-11-05T08:00:00Z",
	moderationStatus: "visible",
	imageStorageState: "live",
	hiddenReason: null,
	activeFlags: [
		{
			id: "flag-1",
			flagType: "harassment",
			channel: "text",
			detectionSource: "gemini_safety",
			confidence: 0.88,
			evidence: "Có dấu hiệu công kích cá nhân",
			quote: "người dẫn đoàn vô trách nhiệm",
			targetImageIndex: null,
			createdAt: "2026-11-05T08:05:00Z",
		},
	],
};

const sampleQuarantinedItem: ModerationQueueItem = {
	reviewId: "rev-quarantine-999",
	tripId: "trip-456",
	tripTitle: "Trekking Bạch Mộc Lương Tử",
	reviewerId: "user-999",
	rating: 1,
	comment: "Hình ảnh phản cảm",
	images: ["/uploads/trip-reviews/bad.jpg"],
	sourceRevision: 1,
	createdAt: "2026-11-06T09:00:00Z",
	moderationStatus: "hidden",
	imageStorageState: "quarantined",
	hiddenReason: "inappropriate_image",
	activeFlags: [
		{
			id: "flag-2",
			flagType: "inappropriate_image",
			channel: "image",
			detectionSource: "rekognition",
			confidence: 0.95,
			evidence: "Hình ảnh vi phạm thuần phong mỹ tục",
			quote: null,
			targetImageIndex: 0,
			createdAt: "2026-11-06T09:01:00Z",
		},
	],
};

const sampleQueueResponse: ModerationQueueResponse = {
	items: [sampleQueueItem],
	total: 1,
	page: 1,
	limit: 10,
};

const sampleTripFeedbackResponse: TripFeedbackOverviewResponse = {
	items: [
		{
			tripId: "trip-456",
			tripTitle: "Trekking Bạch Mộc Lương Tử",
			totalReviews: 8,
			analyzedReviewsCount: 8,
			coverageRate: 1.0,
			reportedReviewsExcludedCount: 0,
			hasSufficientSample: true,
			aspects: {
				safety: { positive: 5, neutral: 1, negative: 2, netScore: 0.625 },
				guide_support: { positive: 6, neutral: 2, negative: 0, netScore: 0.75 },
				equipment: { positive: 4, neutral: 3, negative: 1, netScore: 0.5 },
				value: { positive: 7, neutral: 1, negative: 0, netScore: 0.875 },
			},
		},
	],
	total: 1,
	page: 1,
	limit: 6,
	sampleThreshold: 5,
};

const sampleRouteSafetyResponse: RouteSafetyOverviewResponse = {
	items: [
		{
			routeId: "route-111",
			routeName: "Cung đường Ky Quan San",
			totalReviews: 12,
			analyzedReviewsCount: 12,
			coverageRate: 1.0,
			reportedReviewsExcludedCount: 0,
			hasSufficientSample: true,
			totalDistinctReviewsWithIncidents: 3,
			totalDistinctReviewsWithWarnings: 5,
			incidentSignals: [
				{
					category: "fall_slip",
					occurredCount: 2,
					warningCount: 4,
					unknownCount: 0,
					severityBreakdown: {
						minor: 2,
						moderate: 0,
						severe: 0,
						unknown: 0,
					},
					sampleQuotes: ["Đoạn dốc qua suối trơn trượt rất dễ ngã"],
				},
			],
		},
	],
	total: 1,
	page: 1,
	limit: 5,
	sampleThreshold: 10,
	categoryCountsCannotBeSummed: true,
	notSafetyHotspots: true,
};

describe("Moderation & Analytics UI Components", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url-123");
		global.URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("ModerationQueueTable", () => {
		it("renders queue items with active violation flags and detection channel", async () => {
			mockService.moderationQueue.mockResolvedValue(sampleQueueResponse);

			render(<ModerationQueueTable actor="host-1" />);

			expect(await screen.findByText("Trekking Bạch Mộc Lương Tử")).toBeInTheDocument();
			expect(screen.getByText("Quấy rối hoặc đe dọa")).toBeInTheDocument();
			expect(screen.getByText("Văn bản")).toBeInTheDocument();
			expect(screen.getByText("Nguồn: Gemini Safety")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Xử lý" })).toBeInTheDocument();
		});

		it("shows quarantined images with inspection button and does not prefetch images", async () => {
			mockService.moderationQueue.mockResolvedValue({
				items: [sampleQuarantinedItem],
				total: 1,
				page: 1,
				limit: 10,
			});

			render(<ModerationQueueTable actor="host-1" />);

			expect(await screen.findByText("Xem ảnh #1")).toBeInTheDocument();
			expect(mockService.getQuarantinedImageBlob).not.toHaveBeenCalled();
		});
	});

	describe("QuarantinedImageModal", () => {
		it("loads blob via authenticated endpoint and revokes URL on unmount", async () => {
			const dummyBlob = new Blob(["fake-image"], { type: "image/jpeg" });
			mockService.getQuarantinedImageBlob.mockResolvedValue(dummyBlob);

			const onClose = vi.fn();
			const { unmount } = render(
				<QuarantinedImageModal reviewId="rev-quarantine-999" imageIndex={0} onClose={onClose} />
			);

			await waitFor(() => {
				expect(mockService.getQuarantinedImageBlob).toHaveBeenCalledWith(
					"rev-quarantine-999",
					0,
					expect.any(AbortSignal)
				);
			});

			expect(global.URL.createObjectURL).toHaveBeenCalledWith(dummyBlob);
			expect(await screen.findByAltText("Ảnh bằng chứng vi phạm")).toBeInTheDocument();

			unmount();
			expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-123");
		});

		it("handles 409 conflict during file quarantine operations gracefully", async () => {
			mockService.getQuarantinedImageBlob.mockRejectedValue(
				new HttpError("Image operation in progress", 409, {})
			);

			render(
				<QuarantinedImageModal reviewId="rev-quarantine-999" imageIndex={0} onClose={vi.fn()} />
			);

			expect(
				await screen.findByText(
					"Tệp ảnh đang trong quá trình xử lý lưu trữ. Vui lòng thử lại sau giây lát."
				)
			).toBeInTheDocument();
		});
	});

	describe("ModerationDecisionDialog", () => {
		it("handles 409 stale revision error without crashing or resubmitting", async () => {
			mockService.recordDecision.mockRejectedValue(
				new HttpError("Stale revision conflict", 409, {})
			);

			render(
				<ModerationDecisionDialog item={sampleQueueItem} onClose={vi.fn()} onSuccess={vi.fn()} />
			);

			const submitBtn = screen.getByRole("button", { name: "Xác nhận ẩn đánh giá" });
			fireEvent.click(submitBtn);

			expect(
				await screen.findByText(
					"Đánh giá hoặc trạng thái xử lý đã thay đổi. Vui lòng kiểm tra lại."
				)
			).toBeInTheDocument();
		});

		it("displays adminActionedOverride notice when Admin action supersedes Host restore", async () => {
			mockService.recordDecision.mockResolvedValue({
				decisionId: "dec-1",
				reviewId: "rev-quarantine-999",
				revision: 1,
				decision: "restore",
				reason: null,
				moderationStatus: "hidden",
				imageStorageState: "quarantined",
				adminActionedOverride: true,
				message: "Review remains hidden due to prior Admin moderation action",
				createdAt: "2026-11-06T10:00:00Z",
			});

			render(
				<ModerationDecisionDialog
					item={sampleQuarantinedItem}
					onClose={vi.fn()}
					onSuccess={vi.fn()}
				/>
			);

			const submitBtn = screen.getByRole("button", { name: "Xác nhận khôi phục" });
			fireEvent.click(submitBtn);

			expect(
				await screen.findByText("Đánh giá vẫn đang bị ẩn theo trạng thái xử lý báo cáo hiện có.")
			).toBeInTheDocument();
		});
	});

	describe("TripFeedbackDashboard", () => {
		it("renders 4 aspect categories and net score when sample is sufficient", async () => {
			mockService.tripFeedbackOverview.mockResolvedValue(sampleTripFeedbackResponse);

			render(<TripFeedbackDashboard actor="host-1" />);

			expect(await screen.findByText("Trekking Bạch Mộc Lương Tử")).toBeInTheDocument();
			expect(screen.getByText("An toàn")).toBeInTheDocument();
			expect(screen.getByText("Hỗ trợ của hướng dẫn viên")).toBeInTheDocument();
			expect(screen.getByText("Trang thiết bị")).toBeInTheDocument();
			expect(screen.getByText("Giá trị trải nghiệm")).toBeInTheDocument();
			expect(screen.getByText("63%")).toBeInTheDocument();
		});

		it("displays caution notice and suppresses rankings when sample size is insufficient", async () => {
			mockService.tripFeedbackOverview.mockResolvedValue({
				...sampleTripFeedbackResponse,
				items: [
					{
						...sampleTripFeedbackResponse.items[0],
						totalReviews: 2,
						hasSufficientSample: false,
						aspects: {
							safety: { positive: 1, neutral: 1, negative: 0, netScore: null },
							guide_support: { positive: 2, neutral: 0, negative: 0, netScore: null },
							equipment: { positive: 1, neutral: 0, negative: 0, netScore: null },
							value: { positive: 2, neutral: 0, negative: 0, netScore: null },
						},
					},
				],
			});

			render(<TripFeedbackDashboard actor="host-1" />);

			expect(await screen.findByText("Chưa đạt ngưỡng mẫu (5)")).toBeInTheDocument();
			expect(screen.queryByText("Tỷ lệ tích cực")).toBeNull();
		});
	});

	describe("RouteSafetyDashboard", () => {
		it("renders mandatory disclaimer and distinguishes 3 occurred states with exact copywriting", async () => {
			mockService.routeSafetyOverview.mockResolvedValue(sampleRouteSafetyResponse);

			render(<RouteSafetyDashboard actor="host-1" />);

			// Mandatory disclaimer
			expect(
				await screen.findByText(
					"Đây là nội dung người tham gia mô tả trong đánh giá, chưa phải thống kê sự cố đã được xác minh."
				)
			).toBeInTheDocument();

			expect(await screen.findByText("Cung đường Ky Quan San")).toBeInTheDocument();

			// 3 occurred states exact copywriting
			expect(screen.getByText(/Người viết mô tả sự cố đã xảy ra/)).toBeInTheDocument();
			expect(screen.getByText(/Cảnh báo phòng ngừa/)).toBeInTheDocument();
			expect(screen.getByText(/Chưa xác định rõ/)).toBeInTheDocument();

			// Sample quotes button
			const quotesBtn = screen.getByRole("button", { name: /1 trích dẫn mẫu/ });
			expect(quotesBtn).toBeInTheDocument();

			fireEvent.click(quotesBtn);
			expect(
				await screen.findByText("Đoạn dốc qua suối trơn trượt rất dễ ngã")
			).toBeInTheDocument();
		});
	});
});
