import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import { DemandInsightsPage } from "./DemandInsightsPage";
import { demandService } from "./service";

vi.mock("./service", () => ({
	demandService: {
		periods: vi.fn(),
		report: vi.fn(),
		create: vi.fn(),
		planning: vi.fn(),
		createPlanning: vi.fn(),
	},
}));
const edge = vi.mocked(demandService);
beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
	edge.periods.mockResolvedValue({
		periods: [
			{ month: "2026-10", canCreate: true, hasReport: false, availableAt: "2026-11-03T17:00:00Z" },
		],
	});
	edge.report.mockRejectedValue(new HttpError("missing", 404, {}));
	edge.planning.mockResolvedValue({
		status: "unavailable",
		reportVersion: "report",
		dataPeriod: "2026-10",
		generatedAt: null,
		stale: false,
		recommendations: [],
		errorCode: null,
	});
	edge.createPlanning.mockResolvedValue({ status: "pending", reused: false });
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
describe("CTMS-416 presentation", () => {
	it("shows the server-authorized retry action and disables it immediately while submitting", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report",
			generatedAt: null,
			dataWindow: { start: "", end: "" },
			status: "failed",
			stale: false,
			cells: [],
			suggestions: [],
			errorCode: "analysis_unavailable",
			canRetry: true,
		});
		edge.create.mockImplementation(() => new Promise(() => {}));
		render(<DemandInsightsPage actor="host" />);
		const retry = await screen.findByRole("button", { name: "Thử lại báo cáo" });
		fireEvent.click(retry);
		fireEvent.click(retry);
		await waitFor(() => expect(edge.create).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("button", { name: "Đang gửi…" })).toBeDisabled();
	});
	it("does not offer retry when the server has exhausted the allowance", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report",
			generatedAt: null,
			dataWindow: { start: "", end: "" },
			status: "failed",
			stale: false,
			cells: [],
			suggestions: [],
			errorCode: "analysis_unavailable",
			canRetry: false,
		});
		render(<DemandInsightsPage actor="host" />);
		await screen.findByText("Chưa tạo được báo cáo. Đã dừng xử lý cho tháng này.");
		expect(screen.queryByRole("button", { name: "Thử lại báo cáo" })).not.toBeInTheDocument();
	});
	it("announces refresh progress and disables repeated refresh clicks", async () => {
		render(<DemandInsightsPage actor="host" />);
		await screen.findByText("Chưa có báo cáo cho tháng này.");
		let rejectRefresh: (reason: Error) => void = () => {};
		edge.report.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectRefresh = reject;
				})
		);
		fireEvent.click(screen.getByRole("button", { name: "Làm mới báo cáo" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Làm mới báo cáo" })).toHaveAttribute(
				"aria-busy",
				"true"
			)
		);
		expect(screen.getByRole("button", { name: "Làm mới báo cáo" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Làm mới báo cáo" })).toHaveTextContent("Đang tải…");
		rejectRefresh(new HttpError("missing", 404, {}));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Làm mới báo cáo" })).toBeEnabled()
		);
	});
	it("shows the requested title, accessible refresh and 404 creation action", async () => {
		render(<DemandInsightsPage actor="host" />);
		expect(await screen.findByText("Chưa có báo cáo cho tháng này.")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Nhu cầu đặt chỗ theo tháng" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Làm mới báo cáo" })).toHaveTextContent("Làm mới");
		expect(screen.getByRole("button", { name: "Tạo báo cáo" })).toBeEnabled();
	});
	it("prefers the latest existing report to a newer creatable month", async () => {
		edge.periods.mockResolvedValue({
			periods: [
				{
					month: "2026-10",
					canCreate: true,
					hasReport: false,
					availableAt: "2026-11-03T17:00:00Z",
				},
				{
					month: "2026-09",
					canCreate: false,
					hasReport: true,
					availableAt: "2026-10-03T17:00:00Z",
				},
			],
		});
		render(<DemandInsightsPage actor="host" />);
		await waitFor(() =>
			expect(screen.getByRole("combobox", { name: "Tháng" })).toHaveValue("2026-09")
		);
	});
	it("disables unsettled periods using only the server availability", async () => {
		edge.periods.mockResolvedValue({
			periods: [
				{
					month: "2026-10",
					canCreate: false,
					hasReport: false,
					availableAt: "2026-11-08T17:00:00Z",
				},
				{
					month: "2026-09",
					canCreate: true,
					hasReport: false,
					availableAt: "2026-10-03T17:00:00Z",
				},
			],
		});
		render(<DemandInsightsPage actor="host" />);
		const option = await screen.findByRole("option", { name: /Tháng 10\/2026 \(từ ngày/ });
		expect(option).toBeDisabled();
		expect(option).toHaveTextContent("9/11/26");
	});
	for (const status of [401, 403])
		it(`renders a neutral access message for ${status}`, async () => {
			edge.report.mockRejectedValue(new HttpError("private error", status, {}));
			render(<DemandInsightsPage actor="host" />);
			expect(await screen.findByText("Bạn không có quyền xem trang này.")).toBeInTheDocument();
			expect(screen.queryByText("private error")).not.toBeInTheDocument();
		});
	it("immediately disables creation and displays Retry-After cooldown", async () => {
		edge.create.mockRejectedValue(
			new HttpError("rate", 429, { retryAfterSeconds: 99 }, new Headers({ "Retry-After": "30" }))
		);
		render(<DemandInsightsPage actor="host" />);
		fireEvent.click(await screen.findByRole("button", { name: "Tạo báo cáo" }));
		expect(await screen.findByText("Vui lòng đợi 30 giây rồi thử lại.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tạo báo cáo" })).toBeDisabled();
		expect(edge.create).toHaveBeenCalledTimes(1);
	});

	it("shows 'Gợi ý tổ chức chuyến' button when report is succeeded and planning is not_requested", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report-1",
			generatedAt: "2026-11-06T15:30:00Z",
			dataWindow: { start: "", end: "" },
			status: "succeeded",
			stale: false,
			cells: [{ tripType: "day_trip", difficulty: "moderate", bookerBand: { min: 20, max: 29 } }],
			suggestions: [],
			errorCode: null,
		});
		edge.planning.mockResolvedValue({
			status: "not_requested",
			reportVersion: "report-1",
			dataPeriod: "2026-10",
			generatedAt: null,
			stale: false,
			recommendations: [],
			errorCode: null,
		});
		render(<DemandInsightsPage actor="host" />);
		const planBtn = await screen.findByRole("button", { name: "Gợi ý tổ chức chuyến" });
		expect(planBtn).toBeEnabled();
		expect(
			screen.getByText(/Bạn có thể xem thêm gợi ý chi tiết về khoảng giá/)
		).toBeInTheDocument();
	});

	it("disables 'Gợi ý tổ chức chuyến' immediately while submitting and guards against double-click", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report-1",
			generatedAt: "2026-11-06T15:30:00Z",
			dataWindow: { start: "", end: "" },
			status: "succeeded",
			stale: false,
			cells: [{ tripType: "day_trip", difficulty: "moderate", bookerBand: { min: 20, max: 29 } }],
			suggestions: [],
			errorCode: null,
		});
		edge.planning.mockResolvedValue({
			status: "not_requested",
			reportVersion: "report-1",
			dataPeriod: "2026-10",
			generatedAt: null,
			stale: false,
			recommendations: [],
			errorCode: null,
		});
		edge.createPlanning.mockImplementation(() => new Promise(() => {}));
		render(<DemandInsightsPage actor="host" />);
		const planBtn = await screen.findByRole("button", { name: "Gợi ý tổ chức chuyến" });
		fireEvent.click(planBtn);
		fireEvent.click(planBtn);
		await waitFor(() => expect(edge.createPlanning).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("button", { name: "Đang gửi…" })).toBeDisabled();
	});

	it("honors 429 body fallback when Retry-After header is missing on planning", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report-1",
			generatedAt: "2026-11-06T15:30:00Z",
			dataWindow: { start: "", end: "" },
			status: "succeeded",
			stale: false,
			cells: [{ tripType: "day_trip", difficulty: "moderate", bookerBand: { min: 20, max: 29 } }],
			suggestions: [],
			errorCode: null,
		});
		edge.planning.mockResolvedValue({
			status: "not_requested",
			reportVersion: "report-1",
			dataPeriod: "2026-10",
			generatedAt: null,
			stale: false,
			recommendations: [],
			errorCode: null,
		});
		edge.createPlanning.mockRejectedValue(new HttpError("rate", 429, { retryAfterSeconds: 45 }));
		render(<DemandInsightsPage actor="host" />);
		const planBtn = await screen.findByRole("button", { name: "Gợi ý tổ chức chuyến" });
		fireEvent.click(planBtn);
		expect(await screen.findByText("Vui lòng đợi 45 giây rồi thử lại.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gợi ý tổ chức chuyến" })).toBeDisabled();
	});

	it("does not offer planning button when planning is unavailable or withheld", async () => {
		edge.report.mockResolvedValue({
			month: "2026-10",
			version: "report-1",
			generatedAt: "2026-11-06T15:30:00Z",
			dataWindow: { start: "", end: "" },
			status: "succeeded",
			stale: false,
			cells: [{ tripType: "day_trip", difficulty: "moderate", bookerBand: { min: 20, max: 29 } }],
			suggestions: [],
			errorCode: null,
		});
		edge.planning.mockResolvedValue({
			status: "unavailable",
			reportVersion: "report-1",
			dataPeriod: "2026-10",
			generatedAt: null,
			stale: false,
			recommendations: [],
			errorCode: null,
		});
		render(<DemandInsightsPage actor="host" />);
		await screen.findByText("Chưa hỗ trợ gợi ý tổ chức chuyến cho kỳ báo cáo này.");
		expect(screen.queryByRole("button", { name: "Gợi ý tổ chức chuyến" })).not.toBeInTheDocument();
	});
});
