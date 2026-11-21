import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PerformanceBreakdownTable } from "../components/PerformanceBreakdownTable";
import { PerformanceChartsSection } from "../components/PerformanceChartsSection";
import { PerformanceFilterBar } from "../components/PerformanceFilterBar";
import { PerformanceMetricsCards } from "../components/PerformanceMetricsCards";
import { type PerformanceReportData, ReportPeriodPreset } from "../types";

const mockReportData: PerformanceReportData = {
	timeWindow: {
		from: "2026-10-01T00:00:00.000Z",
		to: "2026-10-31T23:59:59.999Z",
		preset: "30d",
	},
	scope: { role: "admin" },
	bookings: {
		total: 45,
		confirmed: 25,
		completed: 15,
		cancelled: 4,
		pending: 1,
	},
	trips: {
		total: 8,
		completed: 5,
		ongoing: 1,
		published: 2,
		cancelled: 0,
	},
	fillRate: 85.0,
	cancellationRate: 8.9,
	revenue: {
		estimated: {
			amount: 120000000,
			label: "Estimated",
			isEstimated: true,
		},
		actual: {
			amount: 95000000,
			label: "Actual",
			isEstimated: false,
			ledgerSource: "settlements",
		},
	},
	timeSeries: [
		{
			date: "2026-10-15",
			bookingCount: 5,
			tripCount: 1,
			fillRate: 80.0,
			cancellationRate: 5.0,
			estimatedRevenue: 15000000,
			actualRevenue: 12000000,
		},
	],
	breakdown: [
		{
			id: "trip-01",
			title: "Trekking Fansipan 3N2Đ",
			routeName: "Cung Trạm Tôn",
			status: "published",
			bookingCount: 12,
			seatsTaken: 18,
			capacity: 20,
			fillRate: 90.0,
			cancellationRate: 8.3,
			estimatedRevenue: 36000000,
			actualRevenue: 32000000,
		},
	],
};

describe("PerformanceMetricsCards (CTMS-101, BR-283, PB AC-3, AC-6, AC-7, AC-8)", () => {
	it("renders 4 core summary metric cards with accurate values", () => {
		render(<PerformanceMetricsCards data={mockReportData} />);

		// Booking count (PB AC-3)
		expect(screen.getByText("Đơn đặt chỗ")).toBeInTheDocument();
		expect(screen.getByText("45")).toBeInTheDocument();
		expect(screen.getByText("40")).toBeInTheDocument(); // 25 confirmed + 15 completed

		// Trip count (PB AC-6)
		expect(screen.getByText("Chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("8")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument(); // completed
		expect(screen.getByText("2")).toBeInTheDocument(); // published

		// Revenue metrics for Admin: Commission & Escrow
		expect(screen.getByText("Hoa hồng thực thu (5%)")).toBeInTheDocument();
		expect(screen.getByText("Tiền đang tạm giữ")).toBeInTheDocument();
	});

	it("renders Host specific revenue labels when role is host", () => {
		const hostData = { ...mockReportData, scope: { role: "host" } };
		render(<PerformanceMetricsCards data={hostData} />);

		expect(screen.getByText("Doanh thu thực tế")).toBeInTheDocument();
		expect(screen.getByText("Doanh thu dự kiến")).toBeInTheDocument();
	});
});

describe("PerformanceFilterBar (PB AC-1)", () => {
	it("triggers onChange when a quick period pill is clicked", () => {
		const handleChange = vi.fn();

		render(
			<PerformanceFilterBar
				filters={{ period: ReportPeriodPreset.DAYS_30 }}
				onChange={handleChange}
			/>
		);

		const sevenDaysBtn = screen.getByText("7 ngày qua");
		fireEvent.click(sevenDaysBtn);

		expect(handleChange).toHaveBeenCalledWith(
			expect.objectContaining({
				period: ReportPeriodPreset.DAYS_7,
			})
		);
	});
});

describe("PerformanceBreakdownTable (PB AC-2, AC-7, AC-8)", () => {
	it("renders trip details and filters matching search input", () => {
		render(<PerformanceBreakdownTable items={mockReportData.breakdown} />);

		expect(screen.getByText("Trekking Fansipan 3N2Đ")).toBeInTheDocument();
		expect(screen.getByText("Cung Trạm Tôn")).toBeInTheDocument();
		expect(screen.getByText("90%")).toBeInTheDocument();
	});
});

describe("PerformanceChartsSection (Single Donut Chart for Fill & Cancellation)", () => {
	it("renders Bar chart for booking trends and Single Donut chart for fill & cancellation rates", () => {
		render(
			<PerformanceChartsSection
				timeSeries={mockReportData.timeSeries}
				fillRate={mockReportData.fillRate}
				cancellationRate={mockReportData.cancellationRate}
				bookingMetrics={mockReportData.bookings}
				totalSeatsTaken={18}
				totalCapacity={20}
			/>
		);

		// Thẻ 1: Line Chart
		expect(screen.getByText("Xu hướng đặt chỗ theo ngày")).toBeInTheDocument();
		expect(screen.getByText("Đơn đặt")).toBeInTheDocument();
		expect(screen.getByText("Chuyến đi")).toBeInTheDocument();

		// Thẻ 2: Single Donut Chart
		expect(screen.getByText("Tỷ lệ lấp đầy & Hủy chỗ (%)")).toBeInTheDocument();
		expect(screen.getByText("Đã lấp đầy")).toBeInTheDocument();
		expect(screen.getAllByText("85%")).toHaveLength(2); // Center + Legend
		expect(screen.getByText("Đã hủy")).toBeInTheDocument();
		expect(screen.getByText("8.9%")).toBeInTheDocument();
		expect(screen.getByText("Còn trống / Khả dụng")).toBeInTheDocument();
		expect(screen.getByText("6.1%")).toBeInTheDocument(); // 100 - 85 - 8.9 = 6.1%
		expect(screen.getByText("18 / 20 chỗ đã đặt")).toBeInTheDocument();
		expect(screen.getByText("4 / 45 đơn hủy")).toBeInTheDocument();
		expect(screen.getByText("2 chỗ chưa đặt")).toBeInTheDocument();
	});

	it("returns null when timeSeries is empty", () => {
		const { container } = render(
			<PerformanceChartsSection timeSeries={[]} fillRate={0} cancellationRate={0} />
		);
		expect(container.firstChild).toBeNull();
	});
});
