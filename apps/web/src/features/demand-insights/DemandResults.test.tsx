import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemandResults } from "./DemandResults";
import type { DemandReport } from "./types";

afterEach(cleanup);
const report: DemandReport = {
	month: "2026-10",
	version: "opaque-version",
	generatedAt: "2026-11-06T02:35:00Z",
	dataWindow: { start: "2026-09-30T17:00:00Z", end: "2026-10-31T17:00:00Z" },
	status: "succeeded",
	stale: false,
	errorCode: null,
	cells: [
		{ tripType: "day_trip", difficulty: "easy", bookerBand: { min: 10, max: 19 } },
		{ tripType: "overnight", difficulty: "moderate", bookerBand: { min: 10, max: 19 } },
	],
	suggestions: [{ tripType: "day_trip", difficulty: "easy", reason: "observed_booking_interest" }],
};
describe("CTMS-416 next steps", () => {
	it("keeps taxonomy suggestions without a Trip creation action", () => {
		render(<DemandResults report={report} />);
		expect(screen.queryByRole("link", { name: "Tạo chuyến loại này" })).not.toBeInTheDocument();
		expect(screen.queryByText(/Gợi ý: cân nhắc tổ chức/)).not.toBeInTheDocument();
		const suggestions = within(screen.getByRole("region", { name: "Gợi ý tổ chức chuyến" }));
		expect(
			suggestions.getByText("AI chọn nhóm có nhu cầu; câu chữ do hệ thống viết sẵn.")
		).toBeInTheDocument();
		expect(suggestions.queryByText(/10–19|đã ghi nhận khoảng/)).not.toBeInTheDocument();
	});
	for (const status of ["insufficient_data", "withheld", "failed", "pending", "running"] as const) {
		it(`never offers Trip creation for ${status} even with residual cells`, () => {
			render(<DemandResults report={{ ...report, status }} />);
			expect(screen.queryByRole("link", { name: "Tạo chuyến loại này" })).not.toBeInTheDocument();
			expect(screen.queryByText(/Gợi ý: cân nhắc tổ chức/)).not.toBeInTheDocument();
		});
	}
	it("does not invent a difficulty when the server groups only by Trip type", () => {
		render(
			<DemandResults
				report={{
					...report,
					cells: [{ ...report.cells[0], difficulty: null }],
					suggestions: [{ ...report.suggestions[0], difficulty: null }],
				}}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Có thể cân nhắc: Chuyến trong ngày" })
		).toBeInTheDocument();
	});
	it("suggests only provider-selected released groups without inventing a second recommendation", () => {
		render(<DemandResults report={report} />);
		expect(screen.getByRole("heading", { name: "Gợi ý tổ chức chuyến" })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Có thể cân nhắc: Chuyến trong ngày · Dễ" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Có thể cân nhắc: Chuyến qua đêm · Trung bình" })
		).not.toBeInTheDocument();
		expect(screen.getByText(/Các gợi ý không được xếp hạng ưu tiên/)).toBeInTheDocument();
	});
	it("does not fabricate suggestions for an empty or unsupported provider selection", () => {
		render(
			<DemandResults
				report={{
					...report,
					suggestions: [
						{ tripType: "overnight", difficulty: "expert", reason: "advisory_not_forecast" },
					],
				}}
			/>
		);
		expect(screen.queryByRole("heading", { name: "Gợi ý tổ chức chuyến" })).not.toBeInTheDocument();
	});
	it("links to distinct existing Host Trip list and public search destinations without creating Trips", () => {
		render(<DemandResults report={report} />);
		expect(screen.getByRole("link", { name: "Xem người tham gia & đặt chỗ" })).toHaveAttribute(
			"href",
			"/host/campers?from=demand-insights"
		);
		expect(screen.getByRole("link", { name: "Khám phá chuyến đi" })).toHaveAttribute(
			"href",
			"/trips"
		);
		expect(screen.queryByText("Tạo chuyến mới")).not.toBeInTheDocument();
		expect(
			screen.queryByText(/opaque-version|Chi tiết kỹ thuật|AI gợi ý tham khảo/)
		).not.toBeInTheDocument();
	});
	for (const status of ["insufficient_data", "withheld"] as const) {
		it(`hides cells, versions and personal navigation for ${status} even with residual payload`, () => {
			render(<DemandResults report={{ ...report, status, stale: true }} />);
			expect(screen.getAllByRole("link")).toHaveLength(1);
			expect(screen.getByRole("link", { name: "Khám phá chuyến đi" })).toBeInTheDocument();
			expect(screen.queryByText("opaque-version", { exact: false })).not.toBeInTheDocument();
			expect(screen.queryByText("10–19", { exact: false })).not.toBeInTheDocument();
			expect(
				screen.queryByRole("heading", { name: "Gợi ý tổ chức chuyến" })
			).not.toBeInTheDocument();
			expect(
				screen.getByRole("heading", {
					name:
						status === "withheld"
							? "Báo cáo tháng này không còn được hiển thị để bảo vệ thông tin người đặt."
							: "Tháng này chưa đủ dữ liệu để hiển thị.",
				})
			).toBeInTheDocument();
		});
	}
	it("shows a single privacy/meaning note and both actions for stale success", () => {
		render(<DemandResults report={{ ...report, stale: true }} />);
		expect(screen.queryByText("Gợi ý dựa trên bản báo cáo đã chốt.")).not.toBeInTheDocument();
		expect(screen.getAllByText(/Số người hiển thị theo khoảng/)).toHaveLength(1);
		expect(screen.getAllByText(/Đây là số đã đặt chỗ, không phải dự báo/)).toHaveLength(1);
		expect(screen.queryByRole("link", { name: "Tạo chuyến loại này" })).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Xem người tham gia & đặt chỗ" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Khám phá chuyến đi" })).toBeInTheDocument();
		expect(
			screen.getByText(/Số liệu chốt lúc 09:35 6\/11\/26. Có thể khác dữ liệu hiện tại/)
		).toBeInTheDocument();
	});
	it("does not claim equal demand when the intervals differ", () => {
		render(
			<DemandResults
				report={{
					...report,
					cells: [report.cells[0], { ...report.cells[1], bookerBand: { min: 20, max: 29 } }],
				}}
			/>
		);
		expect(screen.queryByText(/Các nhóm cùng ở mức/)).not.toBeInTheDocument();
	});
});
