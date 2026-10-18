import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../types";
import { RouteDraftWorkspace } from "./RouteDraftWorkspace";

// This repository runs Vitest with isolate:false. Do not leak the editor mock
// through the cached shared form into other form tests.
vi.hoisted(() => vi.resetModules());
afterAll(() => {
	vi.doUnmock("./RouteGeometryEditor");
	vi.doUnmock("./RouteCheckpointsPanel");
	vi.doUnmock("../services/trekking-routes.service");
	vi.resetModules();
});

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { updateDraft: vi.fn(), listMine: vi.fn() },
}));
vi.mock("./RouteGeometryEditor", () => ({ RouteGeometryEditor: () => <div>Vẽ tuyến đường</div> }));
vi.mock("./RouteCheckpointsPanel", () => ({
	RouteCheckpointsPanel: ({ route }: { route: CreatedTrekkingRoute }) => (
		<div data-testid="preparation">
			{route.id}:{route.status}
		</div>
	),
}));
const route: CreatedTrekkingRoute = {
	id: "saved-id",
	name: "Ridge",
	description: "Existing description",
	difficulty: "moderate",
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.1, 16.1],
		],
	},
	lengthMeters: 3500,
	expectedDurationMinutes: 120,
	status: "draft",
	createdAt: "2026-09-01",
	updatedAt: "2026-09-01",
};
describe("RouteDraftWorkspace", () => {
	beforeEach(() => vi.clearAllMocks());
	it("edits route info first and moves to picking locations on Bước tiếp theo", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockResolvedValue({
			...route,
			name: "Updated ridge",
			updatedAt: "2026-09-02",
		});
		render(<RouteDraftWorkspace route={route} mode="edit" />);
		expect(screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })).not.toBeInTheDocument();
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Ridge");
		expect(screen.queryByTestId("preparation")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Bước tiếp theo" }));
		await waitFor(() => expect(screen.getByTestId("preparation")).toBeInTheDocument());
		expect(screen.queryByLabelText("Tên tuyến")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Quay lại thông tin tuyến" }));
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Updated ridge");
	});

	it("opens a non-draft route straight on the locations step", () => {
		render(<RouteDraftWorkspace route={{ ...route, status: "active" }} mode="edit" />);
		expect(screen.getByTestId("preparation")).toHaveTextContent("saved-id:active");
		expect(
			screen.queryByRole("button", { name: "Quay lại thông tin tuyến" })
		).not.toBeInTheDocument();
	});

	it.each(["draft", "pending_approval", "active", "closed"] as const)(
		"opens %s routes straight on the locations step without a draft summary card",
		(status) => {
			render(<RouteDraftWorkspace route={{ ...route, status }} />);
			expect(screen.getByTestId("preparation")).toHaveTextContent(`saved-id:${status}`);
			expect(
				screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })
			).not.toBeInTheDocument();
		}
	);
});
