import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { CreatedTrekkingRoute, RouteStatus } from "../types";
import { TrekkingRouteDetailPage } from "./TrekkingRouteDetailPage";

vi.mock("../hooks/useTrekkingRoutes", () => ({ useTrekkingRoutes: vi.fn() }));
vi.mock("../hooks/useRouteCheckpoints", () => ({
	useRouteCheckpoints: () => ({ items: [], isLoading: false, error: "", reload: vi.fn() }),
}));
vi.mock("../hooks/useRouteDangerZones", () => ({
	useRouteDangerZones: () => ({ items: [], isLoading: false, error: "", reload: vi.fn() }),
}));
vi.mock("../components/RouteSafetyPreview", () => ({
	RouteSafetyPreview: () => <div data-testid="geometry-preview" />,
}));
vi.mock("../components/RouteStatusActionDialog", () => ({ RouteStatusActionDialog: () => null }));

function route(status: RouteStatus): CreatedTrekkingRoute {
	return {
		id: "route-id",
		name: "Son Tra Ridge",
		description: "Đường mòn ven biển",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.2, 16.05],
				[108.23, 16.08],
			],
		},
		lengthMeters: 3245.6,
		difficulty: "hard",
		expectedDurationMinutes: 150,
		status,
		createdAt: "2026-08-25T03:00:00.000Z",
		updatedAt: "2026-08-25T03:00:00.000Z",
	};
}

function mockRoutes(items: CreatedTrekkingRoute[]) {
	vi.mocked(useTrekkingRoutes).mockReturnValue({
		items,
		pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
		statusFilter: "all",
		isLoading: false,
		error: "",
		setPage: vi.fn(),
		setStatusFilter: vi.fn(),
		retry: vi.fn(),
	});
}

describe("TrekkingRouteDetailPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows route information and opens the editor for a draft", () => {
		mockRoutes([route("draft")]);
		const onEdit = vi.fn();
		render(<TrekkingRouteDetailPage routeId="route-id" onBack={vi.fn()} onEdit={onEdit} />);
		expect(screen.getByRole("heading", { name: "Son Tra Ridge" })).toBeInTheDocument();
		expect(screen.getByText("150 phút")).toBeInTheDocument();
		expect(screen.getByText("3.25 km")).toBeInTheDocument();
		expect(screen.getByText("Đường mòn ven biển")).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
		expect(onEdit).toHaveBeenCalledWith("route-id");
	});

	it("hides editing once the route left draft", () => {
		mockRoutes([route("active")]);
		render(<TrekkingRouteDetailPage routeId="route-id" onBack={vi.fn()} onEdit={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
	});

	it("reports a missing route and goes back to the list", () => {
		mockRoutes([]);
		const onBack = vi.fn();
		render(<TrekkingRouteDetailPage routeId="route-id" onBack={onBack} onEdit={vi.fn()} />);
		expect(screen.getByText("Không tìm thấy tuyến đường.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Quay về danh sách tuyến" }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});
