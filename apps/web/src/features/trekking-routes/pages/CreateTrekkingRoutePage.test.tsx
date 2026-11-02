import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { CreatedTrekkingRoute } from "../types";
import { CreateTrekkingRoutePage } from "./CreateTrekkingRoutePage";

const savedRoute: CreatedTrekkingRoute = {
	id: "saved-route",
	name: "Ridge",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.02, 16.02],
		],
	},
	difficulty: "moderate",
	expectedDurationMinutes: 120,
	lengthMeters: 3500,
	status: "draft",
	createdAt: "2026-09-01",
	updatedAt: "2026-09-01",
};

vi.mock("../hooks/useTrekkingRoutes", () => ({ useTrekkingRoutes: vi.fn() }));
vi.mock("../components/RouteDraftWorkspace", () => ({
	RouteDraftWorkspace: ({
		route,
		onSubmitted,
	}: {
		route?: CreatedTrekkingRoute;
		onSubmitted?: (route: CreatedTrekkingRoute) => void;
	}) => (
		<div data-testid="route-workspace">
			{route?.id ?? "new-route"}
			<button
				type="button"
				onClick={() =>
					onSubmitted?.({
						...savedRoute,
						id: route?.id ?? "created-id",
						status: "pending_approval",
					})
				}
			>
				Submit completed
			</button>
		</div>
	),
}));

describe("CreateTrekkingRoutePage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("opens the form workspace for a new route and navigates only after submission", () => {
		const onViewRouteDetail = vi.fn();
		render(<CreateTrekkingRoutePage onViewRouteDetail={onViewRouteDetail} />);
		expect(screen.getByTestId("route-workspace")).toHaveTextContent("new-route");
		expect(onViewRouteDetail).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Submit completed" }));
		expect(onViewRouteDetail).toHaveBeenCalledWith("created-id");
	});

	it("uses the same workspace to edit and submit an existing route", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [savedRoute],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			statusFilter: "all",
			setPage: vi.fn(),
			setStatusFilter: vi.fn(),
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		const onViewRouteDetail = vi.fn();
		render(<CreateTrekkingRoutePage routeId="saved-route" onViewRouteDetail={onViewRouteDetail} />);
		expect(screen.getByRole("heading", { name: "Chỉnh sửa tuyến trekking" })).toBeInTheDocument();
		expect(screen.getByTestId("route-workspace")).toHaveTextContent("saved-route");
		fireEvent.click(screen.getByRole("button", { name: "Submit completed" }));
		expect(onViewRouteDetail).toHaveBeenCalledWith("saved-route");
		fireEvent.click(screen.getByRole("button", { name: "Quay về chi tiết tuyến" }));
		expect(onViewRouteDetail).toHaveBeenCalledTimes(2);
	});
});
