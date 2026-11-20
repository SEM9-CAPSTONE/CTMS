import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api/httpClient";
import { resolveVietnamPresetRange } from "./constants";
import { HostBusinessAnalyticsPage } from "./pages/HostBusinessAnalyticsPage";
import { hostAnalyticsService } from "./services/host-analytics.service";
import type { HostAnalyticsResponse, HostSuggestionJobResponse } from "./types";

vi.mock("../revenue-analytics/hooks/useRevenueAnalytics", () => ({
	useGeoAreas: () => ({
		data: [
			{
				code: "DNG-SON-TRA",
				name: "Bán đảo Sơn Trà",
				provinceCode: "48",
				provinceName: "Đà Nẵng",
			},
		],
	}),
}));

vi.mock("../demand-insights/DemandInsightsPage", () => ({
	DemandInsightsPage: () => <div data-testid="market-demand-tab">Market Demand Loaded</div>,
}));

const sampleAnalytics: HostAnalyticsResponse = {
	financial: {
		currency: "VND",
		timeWindow: { from: "2025-11-20T00:00:00.000Z", to: "2026-11-20T23:59:59.999Z" },
		granularity: "month",
		scope: { role: "host", hostId: "host-1", areaCode: "DNG-SON-TRA" },
		dateBasis: {},
		kpis: {
			grossRevenue: 12000000,
			refundAmount: 500000,
			platformFee: 575000,
			netRevenue: 10925000,
			postSettlementRefund: 0,
			payout: null,
			heldFunds: 1000000,
			pendingPayout: null,
			pendingRefundAmount: 0,
			pendingRefundCount: 0,
		},
		payoutAreaScoped: false,
		timeSeries: [],
		byArea: [],
		byTrip: [],
	},
	operations: {
		totalGuests: 16,
		fillRate: 80,
		cancellationRate: 10,
		completedTripCount: 2,
		includedFillTripCount: 2,
		excludedTrips: [],
		cancelledTrips: { count: 1, tripCancellationRate: 33.33, bookingsOnCancelledTrips: 2 },
		byTrip: [],
		byRoute: [
			{
				routeId: "r-1",
				routeName: "Tuyến Sơn Trà",
				tripCount: 2,
				totalGuests: 16,
				fillRate: 80,
				cancellationRate: 10,
			},
		],
		byArea: [],
		byDepartureMonth: [],
	},
	upcoming: {
		tripCount: 1,
		totalCapacityMax: 10,
		totalSeatsTaken: 3,
		includesHeldSeats: true,
		trips: [
			{
				tripId: "up-1",
				title: "Săn mây Sơn Trà tuần sau",
				routeId: "r-1",
				routeName: "Tuyến Sơn Trà",
				areaCode: "DNG-SON-TRA",
				areaName: "Bán đảo Sơn Trà",
				status: "published",
				startsAt: "2026-12-05T01:00:00.000Z",
				capacityMin: 4,
				capacityMax: 10,
				seatsTaken: 3,
			},
		],
	},
	leadTime: { averageDays: 9.5, medianDays: 8, sampleSize: 4 },
	seasonality: {
		status: "insufficient_history",
		basis: "all_history",
		historySpanMonths: 7,
		trend: [{ month: "2026-05", tripCount: 2, totalGuests: 16, fillRate: 80 }],
		highestMonths: null,
		lowestMonths: null,
	},
	externalSeason: { status: "not_available" },
	profit: null,
	profitStatus: "insufficient_data",
	smallSample: true,
	dataBasis: {
		timezone: "Asia/Ho_Chi_Minh",
		financialBasis: "payment_succeeded_at",
		operationsBasis: "trips.starts_at",
		period: { from: "2025-11-20T00:00:00.000Z", to: "2026-11-20T23:59:59.999Z" },
		analyzedTripCount: 2,
		generatedAt: "2026-11-20T04:00:00.000Z",
		formulaVersion: "host-analytics-v1",
	},
};

const sampleStaleJob: HostSuggestionJobResponse = {
	id: "job-1",
	status: "succeeded",
	periodFrom: "2025-11-20T00:00:00.000Z",
	periodTo: "2026-11-20T23:59:59.999Z",
	areaCode: null,
	promptVersion: "host-planning-v1",
	errorCode: null,
	stale: true,
	createdAt: "2026-11-19T04:00:00.000Z",
	startedAt: "2026-11-19T04:00:01.000Z",
	finishedAt: "2026-11-19T04:00:05.000Z",
	suggestions: [
		{
			id: "sug-1",
			routeId: "r-1",
			routeName: "Tuyến Sơn Trà",
			areaCode: "DNG-SON-TRA",
			areaName: "Bán đảo Sơn Trà",
			tripType: "day_trip",
			monthHint: "2027-01",
			priceBand: "500k_1m",
			capacityBand: "small_1_6",
			suggestedPricePerPerson: 650000,
			suggestedCapacityMin: 6,
			rationaleCodes: ["high_fill_history"],
			rationaleLabels: ["Tuyến có tỷ lệ lấp đầy lịch sử cao"],
			missingData: [],
			createdAt: "2026-11-19T04:00:05.000Z",
		},
	],
};

function renderPage(onNavigate = vi.fn()) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<HostBusinessAnalyticsPage actor="host-1" onNavigate={onNavigate} />
		</QueryClientProvider>
	);
}

describe("HostBusinessAnalyticsPage (CTMS-416)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		window.history.replaceState({}, "", "/host/demand-insights");
	});

	it("computes Vietnam timezone start/end boundaries regardless of UTC instant", () => {
		// 2026-11-20T18:30:00.000Z is already 2026-11-21 01:30+07:00 in Vietnam
		const range = resolveVietnamPresetRange("30d", new Date("2026-11-20T18:30:00.000Z"));
		expect(range.toDate).toBe("2026-11-21");
		expect(range.fromDate).toBe("2026-10-23");
		expect(range.from).toBe("2026-10-22T17:00:00.000Z");
		expect(range.to).toBe("2026-11-21T16:59:59.999Z");
	});

	it("calls ONLY GET analytics and GET latest on mount (never POST), lazy-mounts market tab, and renders separated KPIs + stale suggestions", async () => {
		const getAnalyticsSpy = vi
			.spyOn(hostAnalyticsService, "getAnalytics")
			.mockResolvedValue(sampleAnalytics);
		const getLatestSpy = vi
			.spyOn(hostAnalyticsService, "getLatestSuggestionJob")
			.mockResolvedValue(sampleStaleJob);
		const postSpy = vi.spyOn(hostAnalyticsService, "createSuggestionJob");

		renderPage();

		expect(await screen.findByText("Phân tích kinh doanh & Gợi ý chuyến đi")).toBeVisible();
		expect(getAnalyticsSpy).toHaveBeenCalledTimes(1);
		expect(getLatestSpy).toHaveBeenCalledTimes(1);
		expect(postSpy).not.toHaveBeenCalled();

		// Market tab must NOT be mounted until selected
		expect(screen.queryByTestId("market-demand-tab")).toBeNull();

		// Separated KPI groups & null/insufficient_history/smallSample/stale handling
		expect(await screen.findByText("Hiệu quả tài chính")).toBeVisible();
		expect(screen.getByText("Hiệu quả vận hành")).toBeVisible();
		expect(screen.getByText("Không tách theo khu vực")).toBeVisible();
		expect(screen.getByText("Chưa đủ dữ liệu chi phí")).toBeVisible();
		expect(screen.getByText("Mẫu dữ liệu nhỏ")).toBeVisible();
		expect(screen.getByText("Cần thêm 5 tháng lịch sử")).toBeVisible();
		expect(screen.getByText("Dữ liệu đã thay đổi")).toBeVisible();
		expect(screen.getByText(/khoảng 650\.000 đ\/người/)).toBeVisible();
		expect(screen.getByText("Tuyến có tỷ lệ lấp đầy lịch sử cao")).toBeVisible();
		// Must NOT display raw band codes
		expect(screen.queryByText("500k_1m")).toBeNull();
		expect(screen.queryByText("small_1_6")).toBeNull();
	});

	it("shows 409 active job conflict period/area and handles 429 cooldown countdown", async () => {
		vi.spyOn(hostAnalyticsService, "getAnalytics").mockResolvedValue(sampleAnalytics);
		vi.spyOn(hostAnalyticsService, "getLatestSuggestionJob").mockRejectedValue(
			new HttpError("Not found", 404, {})
		);
		const createSpy = vi
			.spyOn(hostAnalyticsService, "createSuggestionJob")
			.mockRejectedValueOnce(
				new HttpError("Conflict", 409, {
					error: "active_job_different_params",
					activeJob: {
						id: "job-running",
						status: "running",
						periodFrom: "2026-08-01T00:00:00.000Z",
						periodTo: "2026-11-01T00:00:00.000Z",
						areaCode: "DNG-SON-TRA",
					},
				})
			)
			.mockRejectedValueOnce(
				new HttpError(
					"Too Many Requests",
					429,
					{ error: "cooldown_active", retryAfterSeconds: 45 },
					new Headers({ "retry-after": "45" })
				)
			);

		renderPage();
		const btn = await screen.findByRole("button", { name: "Tạo gợi ý chuyến đi" });

		// First click -> 409 shows active job's period and areaCode
		fireEvent.click(btn);
		expect(
			await screen.findByText(/Đang có một yêu cầu tạo gợi ý khác đang chạy với bộ lọc khác/)
		).toBeVisible();
		expect(screen.getByText(/DNG-SON-TRA/)).toBeVisible();

		// Second click -> 429 shows countdown on button
		fireEvent.click(btn);
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /Chờ 45 giây/ })).toBeDisabled();
		});
		expect(createSpy).toHaveBeenCalledTimes(2);
	});
});
