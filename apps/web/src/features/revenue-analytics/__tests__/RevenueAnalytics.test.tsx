import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { formatVnd as formatVndRaw } from "../../../shared/utils/money";
import { ReportPeriodPreset } from "../../performance-reports/types";
import { RevenueByTripTable } from "../components/RevenueByTripTable";
import { formatBucketLabel, formatShare } from "../components/RevenueCharts";
import { RevenueFilterBar, granularityForPeriod } from "../components/RevenueFilterBar";
import { RevenueKpiCards } from "../components/RevenueKpiCards";
import { RevenueAnalyticsPage } from "../pages/RevenueAnalyticsPage";
import { revenueAnalyticsService } from "../services/revenue-analytics.service";
import type { RevenueAnalyticsData, RevenueKpis } from "../types";

/** Testing Library collapses the non-breaking space Intl puts before "₫". */
const formatVnd = (value: number) => formatVndRaw(value).replace(/\s/g, " ");

const kpis: RevenueKpis = {
	grossRevenue: 5000000,
	refundAmount: 500000,
	platformFee: 175000,
	netRevenue: 3025000,
	postSettlementRefund: 300000,
	payout: 3000000,
	heldFunds: 1000000,
	pendingPayout: 25000,
	pendingRefundAmount: 200000,
	pendingRefundCount: 1,
};

const report: RevenueAnalyticsData = {
	currency: "VND",
	timeWindow: { from: "2026-10-16T00:00:00.000Z", to: "2026-11-15T00:00:00.000Z", preset: "30d" },
	granularity: "month",
	scope: { role: "host", hostId: "host-1" },
	dateBasis: {},
	kpis,
	payoutAreaScoped: true,
	timeSeries: [
		{
			bucket: "2026-10-01",
			grossRevenue: 4000000,
			refundAmount: 500000,
			platformFee: 0,
			netRevenue: 0,
			payout: 0,
		},
		{
			bucket: "2026-11-01",
			grossRevenue: 1000000,
			refundAmount: 0,
			platformFee: 175000,
			netRevenue: 3025000,
			payout: 3000000,
		},
	],
	byArea: [
		{
			areaCode: "DNG-SON-TRA",
			areaName: "Sơn Trà",
			tripCount: 1,
			grossRevenue: 4000000,
			refundAmount: 500000,
			platformFee: 175000,
			netRevenue: 3025000,
			heldFunds: 0,
			grossShare: 80,
		},
		{
			areaCode: null,
			areaName: null,
			tripCount: 1,
			grossRevenue: 1000000,
			refundAmount: 0,
			platformFee: 0,
			netRevenue: 0,
			heldFunds: 1000000,
			grossShare: 20,
		},
	],
	byTrip: [
		{
			tripId: "11111111-1111-4111-8111-111111111111",
			title: "Khám phá bán đảo Sơn Trà",
			startsAt: "2026-10-20T00:00:00.000Z",
			areaName: "Sơn Trà",
			bookingCount: 2,
			grossRevenue: 4000000,
			refundAmount: 500000,
			platformFee: 175000,
			netRevenue: 3025000,
			heldFunds: 0,
			settledAt: "2026-11-02T03:00:00.000Z",
		},
		{
			tripId: "22222222-2222-4222-8222-222222222222",
			title: "Chinh phục đỉnh Bà Nà",
			startsAt: "2026-11-20T00:00:00.000Z",
			areaName: null,
			bookingCount: 1,
			grossRevenue: 1000000,
			refundAmount: 0,
			platformFee: 0,
			netRevenue: 0,
			heldFunds: 1000000,
			settledAt: null,
		},
	],
};

function renderPage() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<RevenueAnalyticsPage />
		</QueryClientProvider>
	);
}

describe("RevenueKpiCards (CTMS-110)", () => {
	it("separates recorded money from money still waiting (BR-325)", () => {
		render(<RevenueKpiCards kpis={kpis} />);

		const recorded = screen.getByRole("region", { name: "Đã ghi nhận" });
		const pending = screen.getByRole("region", { name: "Đang chờ xử lý" });
		expect(within(recorded).getByText(formatVnd(3025000))).toBeInTheDocument();
		expect(within(recorded).getByText(formatVnd(3000000))).toBeInTheDocument();
		expect(within(pending).getByText(formatVnd(1000000))).toBeInTheDocument();
		expect(within(pending).getByText("1 yêu cầu")).toBeInTheDocument();
		expect(within(recorded).queryByText(formatVnd(1000000))).not.toBeInTheDocument();
		expect(screen.getByText(/Đã trừ .* hoàn sau quyết toán/)).toBeInTheDocument();
	});

	it("shows payouts as not split by area when an area is selected", () => {
		render(<RevenueKpiCards kpis={{ ...kpis, payout: null, pendingPayout: null }} />);
		expect(screen.getAllByText("Không tách theo khu vực")).toHaveLength(2);
	});
});

describe("RevenueByTripTable", () => {
	it("lists trips by name with a plain settlement status and no ids", () => {
		const { container } = render(<RevenueByTripTable trips={report.byTrip} />);

		expect(screen.getByText("Khám phá bán đảo Sơn Trà")).toBeInTheDocument();
		expect(screen.queryByText(/Khởi hành/)).not.toBeInTheDocument();
		const table = screen.getByRole("table", { name: "Bảng doanh thu theo chuyến đi" });
		expect(within(table).getByText("Đã quyết toán")).toBeInTheDocument();
		expect(within(table).getByText("Chưa quyết toán")).toBeInTheDocument();
		expect(container.textContent).not.toContain("11111111");
	});

	it("filters rows by settlement status and trip name", () => {
		render(<RevenueByTripTable trips={report.byTrip} />);

		fireEvent.click(screen.getByRole("button", { name: "Chưa quyết toán" }));
		expect(screen.queryByText("Khám phá bán đảo Sơn Trà")).not.toBeInTheDocument();
		expect(screen.getByText("Chinh phục đỉnh Bà Nà")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
		fireEvent.change(screen.getByLabelText("Tìm chuyến đi"), { target: { value: "sơn trà" } });
		expect(screen.getByText("Khám phá bán đảo Sơn Trà")).toBeInTheDocument();
		expect(screen.queryByText("Chinh phục đỉnh Bà Nà")).not.toBeInTheDocument();
	});
});

describe("RevenueFilterBar", () => {
	it("uses the same period buttons as the performance report and sets the chart bucket", () => {
		const onChange = vi.fn();
		render(<RevenueFilterBar filters={{}} onChange={onChange} areas={[]} />);

		fireEvent.click(screen.getByRole("button", { name: "12 tháng qua" }));
		expect(onChange).toHaveBeenCalledWith({
			period: ReportPeriodPreset.MONTHS_12,
			granularity: "month",
		});
		fireEvent.click(screen.getByRole("button", { name: "30 ngày qua" }));
		expect(onChange).toHaveBeenLastCalledWith({
			period: ReportPeriodPreset.DAYS_30,
			granularity: "day",
		});
		expect(screen.queryByLabelText("Từ ngày")).not.toBeInTheDocument();
	});

	it("shows the Host filter only when Host options are given", () => {
		const { rerender } = render(<RevenueFilterBar filters={{}} onChange={vi.fn()} areas={[]} />);
		expect(screen.getByRole("combobox", { name: "Khu vực" })).toBeInTheDocument();
		expect(screen.queryByRole("combobox", { name: "Chủ chuyến" })).not.toBeInTheDocument();
		rerender(
			<RevenueFilterBar
				filters={{}}
				onChange={vi.fn()}
				areas={[]}
				hosts={[{ id: "h1", fullName: "Nguyễn Minh Quân" }]}
			/>
		);
		expect(screen.getByRole("combobox", { name: "Chủ chuyến" })).toBeInTheDocument();
	});
});

describe("helpers", () => {
	it("maps periods to chart buckets and labels buckets", () => {
		expect(granularityForPeriod(ReportPeriodPreset.DAYS_90)).toBe("week");
		expect(granularityForPeriod(ReportPeriodPreset.ALL_TIME)).toBe("month");
		expect(formatBucketLabel("2026-10-01", "month")).toBe("Th10/2026");
		expect(formatShare(71.38)).toBe("71,4%");
		expect(formatShare(20)).toBe("20%");
		expect(formatBucketLabel("2026-10-05", "week")).toBe("05/10");
	});
});

describe("RevenueAnalyticsPage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(revenueAnalyticsService, "listAreas").mockResolvedValue([
			{ code: "DNG-SON-TRA", name: "Sơn Trà", provinceCode: "DNG", provinceName: "Đà Nẵng" },
		]);
	});

	it("renders the ledger report for the Host", async () => {
		vi.spyOn(revenueAnalyticsService, "getReport").mockResolvedValue(report);
		renderPage();

		expect(
			await screen.findByRole("heading", { name: "Doanh thu theo thời gian và khu vực" })
		).toBeInTheDocument();
		expect(screen.getByText("Chuyến đi của bạn")).toBeInTheDocument();
		expect(
			screen.getByRole("table", { name: "Bảng doanh thu theo chuyến đi" })
		).toBeInTheDocument();
	});

	it("shows a Vietnamese error with a retry button instead of the raw API message", async () => {
		const getReport = vi
			.spyOn(revenueAnalyticsService, "getReport")
			.mockRejectedValue(new HttpError("Forbidden resource", 403, {}));
		renderPage();

		expect(
			await screen.findByText("Bạn không có quyền xem báo cáo doanh thu này.")
		).toBeInTheDocument();
		expect(screen.queryByText("Forbidden resource")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(getReport).toHaveBeenCalledTimes(2);
	});
});
