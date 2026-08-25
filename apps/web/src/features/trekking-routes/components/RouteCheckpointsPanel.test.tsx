import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateRouteCheckpoint } from "../hooks/useCreateRouteCheckpoint";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import type { CreatedTrekkingRoute, RouteCheckpoint } from "../types";
import { RouteCheckpointsPanel } from "./RouteCheckpointsPanel";

vi.mock("../hooks/useRouteCheckpoints", () => ({ useRouteCheckpoints: vi.fn() }));
vi.mock("../hooks/useCreateRouteCheckpoint", () => ({ useCreateRouteCheckpoint: vi.fn() }));
vi.mock("./RouteCheckpointMap", () => ({
	RouteCheckpointMap: ({ disabled }: { disabled?: boolean }) => (
		<div data-testid="panel-map" data-disabled={String(Boolean(disabled))} />
	),
}));
vi.mock("./CreateCheckpointForm", () => ({
	CreateCheckpointForm: ({ disabled }: { disabled: boolean }) => (
		<button type="button" disabled={disabled}>
			Tạo checkpoint
		</button>
	),
}));

const checkpoint: RouteCheckpoint = {
	id: "checkpoint-id",
	routeId: "route-one",
	name: "Rest",
	location: { type: "Point", coordinates: [108.46, 11.94] },
	radiusMeters: 30,
	type: "rest",
	expectedArrivalOffset: 30,
	instructions: "Rest here",
	nearbyWaterOrShelter: false,
	routePosition: 0.5,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
};

function route(id: string, status: CreatedTrekkingRoute["status"]): CreatedTrekkingRoute {
	return {
		id,
		campsiteId: "campsite-id",
		name: id,
		description: null,
		geometry: {
			type: "LineString",
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.94],
			],
		},
		lengthMeters: 2000,
		difficulty: "moderate",
		expectedDurationMinutes: 120,
		status,
		createdAt: "2026-08-25T00:00:00.000Z",
		updatedAt: "2026-08-25T00:00:00.000Z",
	};
}

describe("RouteCheckpointsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useRouteCheckpoints).mockReturnValue({
			items: [checkpoint],
			isLoading: false,
			error: "",
			reload: vi.fn(),
		});
		vi.mocked(useCreateRouteCheckpoint).mockReturnValue({
			submit: vi.fn(),
			isSubmitting: false,
			error: "",
		});
	});

	it("loads the selected route, enables draft create, and preserves the server list", () => {
		render(<RouteCheckpointsPanel route={route("route-one", "draft")} />);
		expect(useRouteCheckpoints).toHaveBeenCalledWith("route-one");
		expect(screen.getByRole("button", { name: "Tạo checkpoint" })).toBeEnabled();
		expect(screen.getByText("Rest")).toBeInTheDocument();
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-disabled", "false");
	});

	it("reloads for a switched route and keeps non-draft checkpoints viewable while create is disabled", () => {
		const { rerender } = render(<RouteCheckpointsPanel route={route("route-one", "draft")} />);
		rerender(<RouteCheckpointsPanel route={route("route-two", "active")} />);
		expect(useRouteCheckpoints).toHaveBeenLastCalledWith("route-two");
		expect(screen.getByText(/Chỉ xem/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tạo checkpoint" })).toBeDisabled();
		expect(screen.getByText("Rest")).toBeInTheDocument();
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-disabled", "true");
	});
});
