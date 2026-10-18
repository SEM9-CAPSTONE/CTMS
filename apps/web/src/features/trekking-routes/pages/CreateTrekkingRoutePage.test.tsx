import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import { CreateTrekkingRoutePage } from "./CreateTrekkingRoutePage";

vi.mock("../hooks/useCreateTrekkingRoute", () => ({ useCreateTrekkingRoute: vi.fn() }));
vi.mock("../hooks/useTrekkingRoutes", () => ({ useTrekkingRoutes: vi.fn() }));
vi.mock("../components/RouteCheckpointsPanel", () => ({
	RouteCheckpointsPanel: ({ route }: { route: { id: string } }) => (
		<div data-testid="inline-checkpoints">{route.id}</div>
	),
}));
vi.mock("../components/CreateTrekkingRouteForm", () => ({
	CreateTrekkingRouteForm: () => <div data-testid="route-form" />,
}));

const creation = {
	isSubmitting: false,
	error: null,
	createdRoute: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};

describe("CreateTrekkingRoutePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useCreateTrekkingRoute).mockReturnValue(creation as never);
	});

	it("shows the route creation form immediately", () => {
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("route-form")).toBeInTheDocument();
	});

	it("renders authoritative server length and status after success", () => {
		vi.mocked(useCreateTrekkingRoute).mockReturnValue({
			...creation,
			createdRoute: {
				id: "saved-route",
				name: "Ridge",
				status: "draft",
				lengthMeters: 1234.56,
				difficulty: "hard",
			},
		} as never);
		render(<CreateTrekkingRoutePage />);
		expect(screen.getByTestId("inline-checkpoints")).toHaveTextContent("saved-route");
		expect(screen.getByTestId("server-route-status")).toHaveTextContent("draft");
		expect(screen.getByTestId("server-route-length")).toHaveTextContent("1234.6 m");
	});

	it("edits a saved route in the same workspace when given a route id", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [
				{
					id: "saved-route",
					name: "Ridge",
					status: "draft",
					lengthMeters: 1234.56,
					difficulty: "hard",
				},
			],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
		const onViewRouteDetail = vi.fn();
		render(<CreateTrekkingRoutePage routeId="saved-route" onViewRouteDetail={onViewRouteDetail} />);
		expect(screen.getByRole("heading", { name: "Chỉnh sửa tuyến trekking" })).toBeInTheDocument();
		expect(screen.getByTestId("route-form")).toBeInTheDocument();
		expect(screen.queryByTestId("inline-checkpoints")).not.toBeInTheDocument();
		expect(screen.queryByTestId("server-route-status")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Quay về chi tiết tuyến" }));
		expect(onViewRouteDetail).toHaveBeenCalledWith("saved-route");
	});
});
