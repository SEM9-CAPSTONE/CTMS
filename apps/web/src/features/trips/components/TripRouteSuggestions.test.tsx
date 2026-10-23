import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { trekkingRoutesService } from "../../trekking-routes/services/trekking-routes.service";
import type { CreatedTrekkingRoute, RouteCheckpoint } from "../../trekking-routes/types";
import { TripRouteSuggestions } from "./TripRouteSuggestions";

const route: CreatedTrekkingRoute = {
	id: "route-safety",
	name: "Bidoup",
	description: null,
	difficulty: "moderate",
	expectedDurationMinutes: 120,
	lengthMeters: 2000,
	status: "active",
	createdAt: "",
	updatedAt: "",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.2, 16],
			[108.21, 16.01],
			[108.22, 16.02],
		],
	},
};
const water: RouteCheckpoint = {
	id: "water",
	routeId: route.id,
	name: "Suối đã xác minh",
	location: { type: "Point", coordinates: [108.21, 16.01] },
	radiusMeters: 20,
	type: "water",
	expectedArrivalOffset: 60,
	instructions: "Kiểm tra chất lượng nước",
	nearbyWaterOrShelter: true,
	routePosition: 0.5,
	createdAt: "",
	updatedAt: "",
};
beforeEach(() => {
	vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	localStorage.setItem("accessToken", "test-token");
	localStorage.setItem("authUser", JSON.stringify({ id: "host-safety", role: "host" }));
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	localStorage.clear();
});

it("lists saved checkpoints without rendering duplicate maps or endpoint selection", async () => {
	vi.spyOn(trekkingRoutesService, "getRouteSafety").mockResolvedValue({
		checkpoints: [water],
		dangerZones: [],
	});
	render(<TripRouteSuggestions selectedRoute={route} />);
	fireEvent.click(screen.getByText("Xem checkpoint và vùng nguy hiểm"));
	const list = await screen.findByRole("list", { name: "Danh sách các vị trí trên tuyến" });
	expect(within(list).getByText("Suối đã xác minh")).toBeVisible();
	expect(screen.queryByTestId("route-map-surface")).not.toBeInTheDocument();
	expect(screen.queryByText("Chọn điểm bắt đầu và kết thúc trên bản đồ")).not.toBeInTheDocument();
});

it("shows a retry when safety data is unavailable without inventing checkpoints", async () => {
	vi.spyOn(trekkingRoutesService, "getRouteSafety").mockRejectedValue(new Error("offline"));
	render(<TripRouteSuggestions selectedRoute={route} />);
	fireEvent.click(screen.getByText("Xem checkpoint và vùng nguy hiểm"));
	expect(await screen.findByRole("button", { name: /Không tải được checkpoint/ })).toBeVisible();
	expect(
		screen.queryByRole("list", { name: "Danh sách các vị trí trên tuyến" })
	).not.toBeInTheDocument();
});
