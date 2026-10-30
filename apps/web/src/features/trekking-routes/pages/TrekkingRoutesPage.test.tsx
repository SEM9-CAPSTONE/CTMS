import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHostRouteBrowser } from "../hooks/useHostRouteBrowser";
import type { CreatedTrekkingRoute } from "../types";
import { TrekkingRoutesPage } from "./TrekkingRoutesPage";
vi.mock("../hooks/useHostRouteBrowser", () => ({ useHostRouteBrowser: vi.fn() }));
vi.mock("../components/RouteSafetyPreview", () => ({
	RouteSafetyPreview: ({
		geometry,
		routeId,
	}: { geometry: { coordinates: number[][] }; routeId: string }) => (
		<div data-testid="geometry-preview" data-route-id={routeId}>
			{JSON.stringify(geometry.coordinates)}
		</div>
	),
}));
const route: CreatedTrekkingRoute = {
	id: "route-one",
	name: "Sơn Trà",
	description: "Đường ven biển",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.2, 16.05],
			[108.23, 16.08],
		],
	},
	difficulty: "hard",
	expectedDurationMinutes: 150,
	lengthMeters: 3250,
	status: "draft",
	createdAt: "2026-10-26T08:42:00Z",
	updatedAt: "2026-10-26T08:42:00Z",
};
function mockBrowser(overrides: Partial<ReturnType<typeof useHostRouteBrowser>> = {}) {
	const model: ReturnType<typeof useHostRouteBrowser> = {
		items: [route],
		pagination: { page: 1, limit: 5, total: 36, totalPages: 8 },
		statusCounts: { all: 36, draft: 8, pending_approval: 4, active: 24, closed: 0 },
		statusFilter: "all",
		search: "",
		sort: "newest",
		isLoading: false,
		error: "",
		setPage: vi.fn(),
		setStatusFilter: vi.fn(),
		setSearch: vi.fn(),
		setSort: vi.fn(),
		retry: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
	vi.mocked(useHostRouteBrowser).mockReturnValue(model);
	return model;
}
describe("Host route browser", () => {
	beforeEach(() => vi.clearAllMocks());
	it("uses a route list beside the selected map without the removed tabs", () => {
		mockBrowser();
		render(<TrekkingRoutesPage />);
		expect(screen.getByRole("heading", { level: 2, name: "Sơn Trà" })).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toHaveAttribute("data-route-id", "route-one");
		expect(screen.getAllByText("3.25 km")).toHaveLength(2);
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
		expect(screen.queryByText("Điểm trên tuyến")).not.toBeInTheDocument();
	});
	it("selects another route for its metadata and map", () => {
		mockBrowser({ items: [route, { ...route, id: "route-two", name: "Bạch Mã" }] });
		render(<TrekkingRoutesPage />);
		fireEvent.click(screen.getByRole("button", { name: /Bạch Mã/ }));
		expect(screen.getByRole("heading", { level: 2, name: "Bạch Mã" })).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toHaveAttribute("data-route-id", "route-two");
	});
	it("shows counts and forwards status, search and sort changes", () => {
		const model = mockBrowser();
		render(<TrekkingRoutesPage />);
		expect(screen.getByRole("button", { name: "Tất cả" })).toHaveTextContent("36");
		fireEvent.click(screen.getByRole("button", { name: "Đang hoạt động" }));
		expect(model.setStatusFilter).toHaveBeenCalledWith("active");
		fireEvent.change(screen.getByLabelText("Tìm tuyến"), { target: { value: "Sơn" } });
		expect(model.setSearch).toHaveBeenCalledWith("Sơn");
		fireEvent.change(screen.getByLabelText("Sắp xếp tuyến"), { target: { value: "oldest" } });
		expect(model.setSort).toHaveBeenCalledWith("oldest");
	});
	it("places numbered pagination and ellipsis under the list and changes page", () => {
		const model = mockBrowser();
		render(<TrekkingRoutesPage />);
		const list = screen.getByRole("complementary", { name: "Danh sách tuyến của Host" });
		const pagination = within(list).getByRole("navigation", { name: "Phân trang danh sách tuyến" });
		expect(within(pagination).getByRole("button", { name: "Trang 1" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(within(pagination).getByText("…")).toBeInTheDocument();
		expect(within(pagination).getByRole("button", { name: "Trang trước" })).toBeDisabled();
		fireEvent.click(within(pagination).getByRole("button", { name: "Trang 8" }));
		expect(model.setPage).toHaveBeenCalledWith(8);
	});
	it("wires create, edit and detail actions to navigation", () => {
		mockBrowser();
		const onCreate = vi.fn();
		const onEdit = vi.fn();
		const onDetail = vi.fn();
		render(
			<TrekkingRoutesPage
				onCreateRoute={onCreate}
				onEditRoute={onEdit}
				onViewRouteDetail={onDetail}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Tạo tuyến mới" }));
		expect(onCreate).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
		expect(onEdit).toHaveBeenCalledWith(route.id);
		fireEvent.click(screen.getByLabelText("Tùy chọn tuyến"));
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
		expect(onDetail).toHaveBeenCalledWith(route.id);
	});
	it("does not offer editing an active route", () => {
		mockBrowser({ items: [{ ...route, status: "active" }] });
		render(<TrekkingRoutesPage onEditRoute={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
	});
	it("keeps rejection feedback from the authoritative route", () => {
		mockBrowser({ items: [{ ...route, latestRejectionReason: "Bổ sung mô tả đường đi." }] });
		render(<TrekkingRoutesPage />);
		expect(screen.getByText("Bổ sung mô tả đường đi.")).toBeInTheDocument();
	});
	it("shows loading, failures and empty filtered results", () => {
		const model = mockBrowser({ items: [], isLoading: true });
		const view = render(<TrekkingRoutesPage />);
		expect(screen.getByTestId("routes-loading")).toBeInTheDocument();
		mockBrowser({ ...model, isLoading: false, error: "Không thể tải danh sách tuyến đường." });
		view.rerender(<TrekkingRoutesPage />);
		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(model.retry).toHaveBeenCalledOnce();
		mockBrowser({
			items: [],
			pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
			search: "Không tồn tại",
		});
		view.rerender(<TrekkingRoutesPage />);
		expect(screen.getByTestId("routes-empty")).toHaveTextContent(
			"Không có tuyến trekking phù hợp với bộ lọc"
		);
	});
});
