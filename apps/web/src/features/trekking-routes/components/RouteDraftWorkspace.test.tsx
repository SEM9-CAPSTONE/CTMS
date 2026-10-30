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
	vi.doUnmock("./RouteSafetyPreview");
	vi.doUnmock("./RouteSubmissionPanel");
	vi.doUnmock("../services/trekking-routes.service");
	vi.resetModules();
});

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { updateDraft: vi.fn(), listMine: vi.fn() },
}));
vi.mock("./RouteGeometryEditor", () => ({ RouteGeometryEditor: () => <div>Vẽ tuyến đường</div> }));
vi.mock("./RouteSafetyPreview", () => ({
	RouteSafetyPreview: ({ routeId }: { routeId: string }) => (
		<div data-testid="safety-preview">{routeId}</div>
	),
}));
vi.mock("./RouteSubmissionPanel", () => ({
	RouteSubmissionPanel: () => <button type="button">Gửi duyệt</button>,
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
	it("saves route edits directly to the safety preview without a waypoint step", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockResolvedValue({
			...route,
			name: "Updated ridge",
			updatedAt: "2026-09-02",
		});
		render(<RouteDraftWorkspace route={route} mode="edit" />);
		expect(screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })).not.toBeInTheDocument();
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
		expect(screen.queryByTestId("route-checkpoints-panel")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Ridge");
		expect(screen.queryByTestId("safety-preview")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() => expect(screen.getByTestId("safety-preview")).toBeInTheDocument());
		expect(screen.queryByLabelText("Tên tuyến")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa tuyến" }));
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Updated ridge");
	});

	it("shows a non-draft route without edit or waypoint controls", () => {
		render(<RouteDraftWorkspace route={{ ...route, status: "active" }} mode="edit" />);
		expect(screen.getByTestId("safety-preview")).toHaveTextContent("saved-id");
		expect(screen.queryByRole("button", { name: "Chỉnh sửa tuyến" })).not.toBeInTheDocument();
	});

	it.each(["draft", "pending_approval", "active", "closed"] as const)(
		"shows saved %s geometry and safety without waypoint controls",
		(status) => {
			render(<RouteDraftWorkspace route={{ ...route, status }} />);
			expect(screen.getByTestId("safety-preview")).toHaveTextContent("saved-id");
			expect(
				screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })
			).not.toBeInTheDocument();
		}
	);
});
