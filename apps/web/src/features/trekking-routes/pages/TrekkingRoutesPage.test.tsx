import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOwnedCampsites } from "../hooks/useOwnedCampsites";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { CreatedTrekkingRoute } from "../types";
import { TrekkingRoutesPage } from "./TrekkingRoutesPage";

vi.mock("../hooks/useOwnedCampsites", () => ({ useOwnedCampsites: vi.fn() }));
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

const campsite = { id: "11111111-1111-4111-8111-111111111111", name: "Da Nang Camp" };
const routes: CreatedTrekkingRoute[] = [
	{
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		campsiteId: campsite.id,
		name: "Sơn Trà Ridge",
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
		window.history.replaceState({}, "", `/host/trekking-routes?campsiteId=${campsite.id}`);
		vi.mocked(useOwnedCampsites).mockReturnValue({
			items: [campsite],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		} as never);
	});

	it("preselects the owned campsite and shows an empty state", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByLabelText("Khu cắm trại")).toHaveValue(campsite.id));
		expect(screen.getByTestId("routes-empty")).toBeInTheDocument();
	});

	it("shows the Route loading state for the selected campsite", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByTestId("routes-loading")).toBeInTheDocument());
	});

	it("shows a Route load error and retries the authoritative request", async () => {
		const retry = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [],
			isLoading: false,
			error: "Không thể tải danh sách tuyến đường.",
			retry,
		});
		render(<TrekkingRoutesPage />);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Không thể tải danh sách tuyến đường.");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it("keeps an open lifecycle dialog mounted during an authoritative reload", async () => {
		const activeRoute: CreatedTrekkingRoute = { ...routes[0], status: "active" };
		const retry = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [activeRoute],
			isLoading: false,
			error: "",
			retry,
		});
		const view = render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByText(activeRoute.name)).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Đóng tuyến đường" }));
		fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Heavy rain" } });

		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: [activeRoute],
			isLoading: true,
			error: "",
			retry,
		});
		view.rerender(<TrekkingRoutesPage />);

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByLabelText("Lý do")).toHaveValue("Heavy rain");
	});

	it("shows route metadata and previews the selected geometry", async () => {
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByText("Sơn Trà Ridge")).toBeInTheDocument());
		expect(screen.getByText("Khó")).toBeInTheDocument();
		expect(screen.getByText("150 phút")).toBeInTheDocument();
		expect(screen.getByText("3.25 km")).toBeInTheDocument();
		expect(screen.getByText("Nháp")).toBeInTheDocument();
		expect(screen.getByTestId("geometry-preview")).toHaveTextContent(
			JSON.stringify(routes[0].geometry.coordinates)
		);
		expect(screen.getByTestId("checkpoints-panel")).toHaveTextContent(routes[0].id);
	});

	it("keeps normal selector behavior for an invalid campsite query", async () => {
		window.history.replaceState({}, "", "/host/trekking-routes?campsiteId=not-owned");
		vi.mocked(useTrekkingRoutes).mockReturnValue({
			items: routes,
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<TrekkingRoutesPage />);

		await waitFor(() => expect(screen.getByLabelText("Khu cắm trại")).toHaveValue(""));
		expect(screen.getByTestId("route-campsite-prompt")).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Khu cắm trại"), { target: { value: campsite.id } });
		expect(screen.getByLabelText("Khu cắm trại")).toHaveValue(campsite.id);
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
		expect(screen.getByTestId("route-submission-success")).toHaveTextContent("Sơn Trà Ridge");
	});
});
