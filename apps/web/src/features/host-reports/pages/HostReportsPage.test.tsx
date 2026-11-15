import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostReportsPage } from "./HostReportsPage";

vi.mock("../../performance-reports/pages/PerformanceReportsPage", () => ({
	PerformanceReportsPage: ({ embedded }: { embedded?: boolean }) => (
		<div>Nội dung hiệu suất {embedded ? "nhúng" : ""}</div>
	),
}));
vi.mock("../../revenue-analytics/pages/RevenueAnalyticsPage", () => ({
	RevenueAnalyticsPage: ({ embedded }: { embedded?: boolean }) => (
		<div>Nội dung doanh thu {embedded ? "nhúng" : ""}</div>
	),
}));

describe("HostReportsPage", () => {
	it("shows the selected report under the Báo cáo tổng quan tabs", () => {
		render(<HostReportsPage activeTab="performance" onTabChange={vi.fn()} />);

		expect(
			screen.getByRole("heading", { level: 1, name: "Báo cáo tổng quan" })
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Báo cáo hiệu suất" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(screen.getByRole("tab", { name: "Báo cáo doanh thu" })).toHaveAttribute(
			"aria-selected",
			"false"
		);
		expect(screen.getByText("Nội dung hiệu suất nhúng")).toBeInTheDocument();
		expect(screen.queryByText(/Nội dung doanh thu/)).not.toBeInTheDocument();
	});

	it("asks to switch tab only when another tab is chosen", () => {
		const onTabChange = vi.fn();
		render(<HostReportsPage activeTab="revenue" onTabChange={onTabChange} />);

		expect(screen.getByText("Nội dung doanh thu nhúng")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: "Báo cáo doanh thu" }));
		expect(onTabChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("tab", { name: "Báo cáo hiệu suất" }));
		expect(onTabChange).toHaveBeenCalledWith("performance");
		fireEvent.click(screen.getByRole("tab", { name: "Báo cáo đánh giá" }));
		expect(onTabChange).toHaveBeenLastCalledWith("submitted");
	});

	it("shows the review report content in the submitted tab", () => {
		render(
			<HostReportsPage activeTab="submitted" onTabChange={vi.fn()}>
				Danh sách báo cáo đã gửi
			</HostReportsPage>
		);

		expect(screen.getByRole("tabpanel", { name: "Báo cáo đánh giá" })).toHaveTextContent(
			"Danh sách báo cáo đã gửi"
		);
	});
});
