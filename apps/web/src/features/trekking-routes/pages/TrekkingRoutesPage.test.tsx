import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { CreatedTrekkingRoute } from "../types";
import { TrekkingRoutesPage } from "./TrekkingRoutesPage";

vi.mock("../hooks/useTrekkingRoutes", () => ({
	useTrekkingRoutes: vi.fn(),
}));

vi.mock("../hooks/useRouteCheckpoints", () => ({
	useRouteCheckpoints: () => ({
		items: [],
		isLoading: false,
		error: "",
		retry: vi.fn(),
	}),
}));

vi.mock("../hooks/useRouteDangerZones", () => ({
	useRouteDangerZones: () => ({
		items: [],
		isLoading: false,
		error: "",
		retry: vi.fn(),
	}),
}));

vi.mock("../components/RouteGeometryPreview", () => ({
	RouteGeometryPreview: ({
		geometry,
		footer,
	}: {
		geometry: { coordinates: number[][] };
		footer?: ReactNode;
	}) => (
		<div>
			<div data-testid="geometry-preview">{JSON.stringify(geometry.coordinates)}</div>
			{footer}
		</div>
	),
}));

const routes: CreatedTrekkingRoute[] = [
	{
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		name: "Son Tra Ridge",
		description: "Coastal trail",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.2, 16.1],
				[108.21, 16.11],
			],
		},
		difficulty: "hard",
		expectedDurationMinutes: 150,
		lengthMeters: 3250,
		status: "draft",
		createdAt: "2026-03-30T10:00:00.000Z",
		updatedAt: "2026-03-30T10:00:00.000Z",
	},
];

describe("TrekkingRoutesPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows an empty state when the Host has no routes", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			statusFilter: "all",
			isLoading: false,
			error: "",
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByTestId("routes-empty")).toBeInTheDocument();
		expect(screen.getByText("Bạn chưa có tuyến trekking")).toBeInTheDocument();
	});

	it("shows Vietnamese status options and forwards filter changes", () => {
		const setStatusFilter = vi.fn();
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			statusFilter: "draft",
			isLoading: false,
			error: "",
			setPage: vi.fn(),
			setStatusFilter,
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		const filter = screen.getByRole("combobox", { name: "Trạng thái tuyến" });
		expect(filter).toHaveValue("draft");
		expect(screen.getByRole("option", { name: "Tất cả" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Bản nháp" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Chờ duyệt" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Đang hoạt động" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Đã đóng" })).toBeInTheDocument();
		expect(screen.getByText("Không có tuyến trekking phù hợp với bộ lọc")).toBeInTheDocument();

		fireEvent.change(filter, { target: { value: "active" } });
		expect(setStatusFilter).toHaveBeenCalledWith("active");
	});

	it("shows the Route loading state", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			statusFilter: "all",
			isLoading: true,
			error: "",
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByTestId("routes-loading")).toBeInTheDocument();
	});

	it("shows an error state with retry", () => {
		const retry = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			statusFilter: "all",
			isLoading: false,
			error: "Không thể tải danh sách tuyến đường.",
			retry,
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải danh sách tuyến đường.");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it("shows route metadata, previews the selected geometry, and opens its detail", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			statusFilter: "all",
			isLoading: false,
			error: "",
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
			retry: vi.fn(),
		});
		const onViewRouteDetail = vi.fn();
		render(<TrekkingRoutesPage onViewRouteDetail={onViewRouteDetail} />);

		await waitFor(() => expect(screen.getAllByText("Son Tra Ridge")[0]).toBeInTheDocument());
		expect(screen.getByText("Khó")).toBeInTheDocument();
		expect(screen.getByText("150 phút")).toBeInTheDocument();
		expect(screen.getByText("3.25 km")).toBeInTheDocument();
		expect(screen.getByText("Nháp")).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toHaveTextContent(
			JSON.stringify(routes[0].geometry.coordinates)
		);

		fireEvent.click(screen.getByRole("button", { name: "Chi tiết" }));
		expect(onViewRouteDetail).toHaveBeenCalledWith(routes[0].id);
	});

	it("shows the latest authoritative rejection reason on the returned Draft Route", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [{ ...routes[0], latestRejectionReason: "Bổ sung hướng dẫn tại điểm nguy hiểm." }],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			statusFilter: "all",
			isLoading: false,
			error: "",
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(await screen.findByText("Admin yêu cầu chỉnh sửa")).toBeInTheDocument();
		expect(screen.getByText("Bổ sung hướng dẫn tại điểm nguy hiểm.")).toBeInTheDocument();
	});

	it("renders shared pagination metadata and requests the next page", () => {
		const setPage = vi.fn();
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
			statusFilter: "all",
			isLoading: false,
			error: "",
			setPage,
			setStatusFilter: vi.fn(),
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByText("Trang 1 / 2")).toBeInTheDocument();
		expect(screen.getByText(/1 - 20/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
		expect(setPage).toHaveBeenCalledWith(2);
	});
});
