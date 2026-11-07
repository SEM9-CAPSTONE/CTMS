import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemandPlanningSection } from "./DemandPlanningSection";
import type { DemandPlanningReport } from "./types";

afterEach(cleanup);

const mockPlanningReport: DemandPlanningReport = {
	status: "succeeded",
	reportVersion: "report-123",
	dataPeriod: "2026-07",
	generatedAt: "2026-11-07T06:51:55.769Z",
	stale: false,
	errorCode: null,
	recommendations: [
		{
			candidateId: "c1",
			tripType: "day_trip",
			difficulty: "easy",
			bookerBand: { min: 10, max: 19 },
			priceBand: "under_500k",
			capacityBand: "11_to_20",
			durationBand: "day",
			area: {
				code: "demo-lowland",
				label: "Vùng đồng bằng mẫu",
				provenance: "host_confirmed_catalog",
			},
			priceRangeLabel: "Dưới 500.000 VND/người",
			capacityRangeLabel: "11–20 chỗ",
			durationLabel: "Trong ngày",
			evidenceBasis: "observed_bookings",
			capacityMeaning: "offered_at_booking",
			generalAdvice: [
				{
					code: "clear_inclusions",
					text: "Trình bày rõ lịch trình, dịch vụ bao gồm và điều kiện tham gia.",
				},
				{
					code: "group_organization",
					text: "Đối chiếu quy mô tham khảo với năng lực hỗ trợ và giới hạn của tuyến trước khi quyết định số chỗ.",
				},
			],
			disclaimer:
				"Thống kê mô tả, không phải giá hoặc quy mô tối ưu và không đảm bảo số người tham gia.",
		},
	],
};

describe("DemandPlanningSection presentation", () => {
	it("renders not_requested state with explanatory note", () => {
		render(<DemandPlanningSection status="not_requested" />);
		expect(
			screen.getByText(/Bạn có thể xem thêm gợi ý chi tiết về khoảng giá/i)
		).toBeInTheDocument();
	});

	it("renders pending/running state with aria-live region", () => {
		render(<DemandPlanningSection status="running" />);
		expect(
			screen.getByRole("heading", {
				name: "Đang tạo gợi ý tổ chức chuyến. Trang sẽ tự cập nhật.",
			})
		).toBeInTheDocument();
		expect(
			screen.getByText("Hệ thống đang phân tích các nhóm nhu cầu đã chốt để đưa ra gợi ý phù hợp.")
		).toBeInTheDocument();
	});

	it("does not invent numeric progress for an active job", () => {
		render(<DemandPlanningSection status="running" />);
		expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});

	it("renders failed state without technical error details", () => {
		render(<DemandPlanningSection status="failed" />);
		expect(
			screen.getByRole("heading", {
				name: "Chưa thể tạo gợi ý tổ chức chuyến cho tháng này.",
			})
		).toBeInTheDocument();
		expect(screen.queryByText(/provider|error|model|hash/i)).not.toBeInTheDocument();
	});

	it("renders unavailable state for legacy reports without planning context", () => {
		render(<DemandPlanningSection status="unavailable" />);
		expect(
			screen.getByText("Chưa hỗ trợ gợi ý tổ chức chuyến cho kỳ báo cáo này.")
		).toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders withheld state for privacy withdrawn reports", () => {
		render(<DemandPlanningSection status="withheld" />);
		expect(
			screen.getByText("Gợi ý tổ chức chuyến không còn được hiển thị để bảo vệ thông tin.")
		).toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders succeeded recommendations separating observed data and planning advice", () => {
		render(<DemandPlanningSection status="succeeded" data={mockPlanningReport} />);

		// Heading
		expect(screen.getByRole("heading", { name: "Gợi ý tổ chức chuyến" })).toBeInTheDocument();

		// Card title and badge
		expect(screen.getByRole("heading", { name: "Chuyến trong ngày · Dễ" })).toBeInTheDocument();
		expect(screen.getByText("10–19 người đã đặt")).toBeInTheDocument();

		// Section headers inside card
		expect(screen.getByRole("heading", { name: "Dữ liệu đã ghi nhận" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Gợi ý tổ chức" })).toBeInTheDocument();

		// Observed facts
		expect(screen.getByText("Dưới 500.000 VND/người")).toBeInTheDocument();
		expect(screen.getByText("11–20 chỗ")).toBeInTheDocument();
		expect(
			screen.getByText("Quy mô chuyến tối đa ghi nhận khi đặt chỗ (không phải số chỗ tối ưu)")
		).toBeInTheDocument();
		expect(screen.getByText("Trong ngày")).toBeInTheDocument();
		expect(screen.getByText("Vùng đồng bằng mẫu")).toBeInTheDocument();

		// Planning advice text
		expect(
			screen.getByText("Trình bày rõ lịch trình, dịch vụ bao gồm và điều kiện tham gia.")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Đối chiếu quy mô tham khảo với năng lực hỗ trợ và giới hạn của tuyến trước khi quyết định số chỗ."
			)
		).toBeInTheDocument();

		// Disclaimer
		expect(
			screen.getByText(
				"Thống kê mô tả, không phải giá hoặc quy mô tối ưu và không đảm bảo số người tham gia."
			)
		).toBeInTheDocument();

		// Stamped time
		expect(screen.getByText(/Gợi ý chốt lúc/)).toBeInTheDocument();
		expect(screen.queryByText(/Dữ liệu có thể khác hiện tại/)).not.toBeInTheDocument();

		// Integrity check: No trip creation action
		expect(screen.queryByRole("link", { name: /tạo chuyến/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /tạo chuyến/i })).not.toBeInTheDocument();
	});

	it("omits null fields without guessing or displaying placeholder values", () => {
		const sparseReport: DemandPlanningReport = {
			...mockPlanningReport,
			recommendations: [
				{
					...mockPlanningReport.recommendations[0],
					difficulty: null,
					priceRangeLabel: null,
					capacityRangeLabel: null,
					durationLabel: null,
					area: null,
					generalAdvice: [],
				},
			],
		};
		render(<DemandPlanningSection status="succeeded" data={sparseReport} />);

		// Type without difficulty
		expect(screen.getByRole("heading", { name: "Chuyến trong ngày" })).toBeInTheDocument();

		// Null fields omitted
		expect(screen.queryByText(/Khoảng giá:/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Sức chứa ghi nhận:/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Thời lượng:/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Khu vực:/)).not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "Gợi ý tổ chức" })).not.toBeInTheDocument();
	});

	it("shows stale warning suffix when stale is true on succeeded report", () => {
		const staleReport: DemandPlanningReport = {
			...mockPlanningReport,
			stale: true,
		};
		render(<DemandPlanningSection status="succeeded" data={staleReport} />);
		expect(screen.getByText(/Dữ liệu có thể khác hiện tại/)).toBeInTheDocument();
	});
});
