import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { CreatedTrekkingRoute } from "../types";
import { TrekkingRoutesPage } from "./TrekkingRoutesPage";

vi.mock("../hooks/useTrekkingRoutes", () => ({ useTrekkingRoutes: vi.fn() }));
vi.mock("../components/RouteGeometryPreview", () => ({
	RouteGeometryPreview: ({ geometry }: { geometry: { coordinates: number[][] } }) => (
		<div data-testid="geometry-preview">{JSON.stringify(geometry.coordinates)}</div>
	),
}));
vi.mock("../components/RouteCheckpointsPanel", () => ({
	RouteCheckpointsPanel: ({
		route,
		onRouteSubmitted,
	}: {
		route: CreatedTrekkingRoute;
		onRouteSubmitted: (route: CreatedTrekkingRoute) => void;
	}) => (
		<button
			type="button"
			data-testid="checkpoints-panel"
			onClick={() => onRouteSubmitted({ ...route, status: "pending_approval" })}
		>
			{route.id}
		</button>
	),
}));

const routes: CreatedTrekkingRoute[] = [
	{
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		name: "Son Tra Ridge",
		description: null,
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
		status: "draft",
		createdAt: "2026-08-25T03:00:00.000Z",
		updatedAt: "2026-08-25T03:00:00.000Z",
	},
];

describe("TrekkingRoutesPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows an empty state when the Host has no routes", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByTestId("routes-empty")).toBeInTheDocument();
	});

	it("shows the Route loading state", () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByTestId("routes-loading")).toBeInTheDocument();
	});

	it("shows a Route load error and retries the authoritative request", () => {
		const retry = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: false,
			error: "Không thể tải danh sách tuyến đường.",
			retry,
		});
		render(<TrekkingRoutesPage />);

		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải danh sách tuyến đường.");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it("shows route metadata and previews the selected geometry", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByText("Son Tra Ridge")).toBeInTheDocument());
		expect(screen.getByText("Khó")).toBeInTheDocument();
		expect(screen.getByText("150 phút")).toBeInTheDocument();
		expect(screen.getByText("3.25 km")).toBeInTheDocument();
		expect(screen.getByText("Nháp")).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toHaveTextContent(
			JSON.stringify(routes[0].geometry.coordinates)
		);
		expect(screen.getByTestId("checkpoints-panel")).toHaveTextContent(routes[0].id);
	});

	it("keeps submission success feedback mounted across the authoritative reload", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByTestId("checkpoints-panel")).toBeInTheDocument());
		fireEvent.click(screen.getByTestId("checkpoints-panel"));

		expect(screen.getByTestId("route-submission-success")).toHaveTextContent("Chờ duyệt");
		expect(screen.getByTestId("route-submission-success")).toHaveTextContent("Son Tra Ridge");
	});
});
