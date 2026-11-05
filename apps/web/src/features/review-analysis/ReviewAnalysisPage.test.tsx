import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import { ReviewAnalysisPage } from "./ReviewAnalysisPage";
import { batch, batchFixture, insightFixture, tripId } from "./review-analysis.test-fixtures";
import { analysisService } from "./service";
import type { InsightResponse } from "./types";
vi.mock("./service", () => ({
	analysisService: {
		trips: vi.fn(),
		insights: vi.fn(),
		batch: vi.fn(),
		create: vi.fn(),
		source: vi.fn(),
	},
}));
const edge = vi.mocked(analysisService);
beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
	edge.trips.mockResolvedValue({
		items: [{ id: tripId, title: "Sơn Trà", status: "completed" }],
		pagination: { page: 1, total: 1, totalPages: 1 },
	});
	edge.insights.mockResolvedValue(insightFixture());
	edge.batch.mockResolvedValue(batchFixture());
	edge.create.mockResolvedValue({ batch, reused: false, remainingCount: 1, hasMore: true });
	edge.source.mockResolvedValue({
		reviewId: "review",
		revision: 2,
		currentRevision: 2,
		rating: 4,
		comment: "Đánh giá gốc",
		createdAt: "2026-11-05T00:00:00Z",
	});
});
afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
const open = () => render(<ReviewAnalysisPage actor="host" initialTripId={tripId} />);
describe("CTMS-412 review analysis UI", () => {
	it("renders untrusted summaries as plain text and loads original review only on request", async () => {
		open();
		await screen.findByText("Cảnh đẹp. <img src=x onerror=alert(1)>");
		expect(document.querySelector("img[src=x]")).toBeNull();
		expect(edge.source).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
		fireEvent.click(screen.getByRole("button", { name: "Xem đánh giá gốc · phiên bản 2" }));
		await screen.findByText("Đánh giá gốc");
		expect(screen.getByText(/4\/5 sao/)).toBeInTheDocument();
	});
	it("filters across pages without changing global coverage", async () => {
		open();
		await screen.findByText("Cảnh đẹp. <img src=x onerror=alert(1)>");
		edge.insights.mockImplementation(async (_id, page, _signal, sentiment) => ({
			...insightFixture(),
			items: sentiment === "neutral" ? [] : insightFixture().items,
			pagination: { page, limit: 6, total: 0, totalPages: 0 },
		}));
		fireEvent.click(screen.getByRole("button", { name: "Trung lập 1" }));
		await waitFor(() =>
			expect(edge.insights).toHaveBeenLastCalledWith(tripId, 1, expect.any(AbortSignal), "neutral")
		);
		await screen.findByText("Chưa có kết quả thuộc nhóm trung lập");
		expect(
			screen.getByRole("heading", { name: /8\s*\/\s*9 đánh giá đủ điều kiện/ })
		).toBeInTheDocument();
	});
	it("keeps list content mounted while loading the next result page", async () => {
		let resolve!: (value: InsightResponse) => void;
		edge.insights.mockImplementation(async (_id, page) =>
			page === 1
				? insightFixture()
				: new Promise((r) => {
						resolve = r;
					})
		);
		open();
		await screen.findByText("Cảnh đẹp. <img src=x onerror=alert(1)>");
		fireEvent.click(screen.getByRole("button", { name: "Trang kết quả tiếp" }));
		expect(screen.getByText("Cảnh đẹp. <img src=x onerror=alert(1)>")).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Trang kết quả tiếp" })).toBeDisabled()
		);
		await act(async () =>
			resolve({ ...insightFixture(), pagination: { page: 2, limit: 6, total: 8, totalPages: 2 } })
		);
		await screen.findByText("Trang 2/2");
	});
	it("does not show another Trip's cached insights when switching Trip", async () => {
		const other = "55555555-5555-4555-8555-555555555555";
		edge.trips.mockResolvedValue({
			items: [
				{ id: tripId, title: "Sơn Trà", status: "completed" },
				{ id: other, title: "Hải Vân", status: "completed" },
			],
			pagination: { page: 1, total: 2, totalPages: 1 },
		});
		edge.insights.mockImplementation(async (id) =>
			id === tripId ? insightFixture() : new Promise(() => {})
		);
		open();
		await screen.findByText("Cảnh đẹp. <img src=x onerror=alert(1)>");
		fireEvent.change(screen.getByRole("combobox"), { target: { value: other } });
		await waitFor(() =>
			expect(screen.queryByText("Cảnh đẹp. <img src=x onerror=alert(1)>")).not.toBeInTheDocument()
		);
	});
	it("distinguishes no eligible reviews from not yet analyzed", async () => {
		const empty = insightFixture();
		empty.items = [];
		empty.coverage = {
			eligible: 0,
			analyzed: 0,
			pending: 0,
			failed: 0,
			stale: 0,
			unprocessed: 0,
			excluded: 0,
			ratio: 0,
		};
		edge.insights.mockResolvedValue(empty);
		open();
		await screen.findByRole("heading", { name: "Chưa có đánh giá đủ điều kiện" });
		expect(screen.getByRole("button", { name: "Phân tích đánh giá" })).toBeDisabled();
	});
	it("masks provider details and blocks analysis after authorization denial", async () => {
		edge.insights.mockRejectedValue(new HttpError("provider secret", 403, {}));
		open();
		await screen.findByRole("heading", { name: "Không thể mở phân tích" });
		expect(screen.queryByText("provider secret")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Phân tích đánh giá" })).toBeDisabled();
	});
	it("prevents double submission while awaiting 202 and then shows active batch", async () => {
		let resolve!: (value: Awaited<ReturnType<typeof analysisService.create>>) => void;
		edge.create.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		open();
		const button = await screen.findByRole("button", { name: "Phân tích đánh giá" });
		await waitFor(() => expect(button).toBeEnabled());
		fireEvent.click(button);
		fireEvent.click(button);
		await waitFor(() => expect(edge.create).toHaveBeenCalledTimes(1));
		await act(async () => resolve({ batch, reused: false, remainingCount: 1, hasMore: true }));
		await screen.findByRole("heading", { name: "Đang xử lý lượt phân tích" });
	});
	it("shows persisted retry countdown for 429 without leaking the server message", async () => {
		edge.create.mockRejectedValue(
			new HttpError("internal rate settings", 429, { retryAfterSeconds: 12 })
		);
		open();
		const button = await screen.findByRole("button", { name: "Phân tích đánh giá" });
		await waitFor(() => expect(button).toBeEnabled());
		fireEvent.click(button);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /Chờ 1[12] giây/ })).toBeDisabled()
		);
		expect(screen.queryByText("internal rate settings")).not.toBeInTheDocument();
	});
	it("refreshes server execution context on a 409 response", async () => {
		edge.create.mockRejectedValue(new HttpError("conflict", 409, {}));
		open();
		const button = await screen.findByRole("button", { name: "Phân tích đánh giá" });
		await waitFor(() => expect(button).toBeEnabled());
		const calls = edge.insights.mock.calls.length;
		fireEvent.click(button);
		await waitFor(() => expect(edge.insights.mock.calls.length).toBeGreaterThan(calls));
	});
	it("loads more Trips from the selector without adding Trip pagination controls", async () => {
		const user = userEvent.setup();
		edge.trips.mockImplementation(async (page) => ({
			items: [
				{
					id: page === 1 ? tripId : "other",
					title: page === 1 ? "Sơn Trà" : "Chuyến khác",
					status: "completed",
				},
			],
			pagination: { page, total: 2, totalPages: 2 },
		}));
		open();
		await screen.findByRole("option", { name: "Tải thêm chuyến đi…" });
		await user.selectOptions(screen.getByRole("combobox"), "load-more-trips");
		await screen.findByRole("option", { name: "Chuyến khác" });
		expect(screen.queryByRole("navigation", { name: "Phân trang chuyến đi" })).toBeNull();
	});
	it("displays partial completion and individual failures separately from successes", async () => {
		edge.insights.mockResolvedValue({
			...insightFixture(),
			latestBatch: { ...batch, status: "partial" },
		});
		edge.batch.mockResolvedValue({
			...batchFixture("partial"),
			batch: { ...batch, status: "partial" },
		});
		open();
		await screen.findByText(/Lượt phân tích hoàn thành một phần/);
		fireEvent.click(screen.getByText("Xem trạng thái từng nhận xét"));
		expect(
			within(screen.getByRole("region", { name: "Lượt phân tích gần nhất" })).getByText(
				"Chưa thành công"
			)
		).toBeInTheDocument();
	});
});
