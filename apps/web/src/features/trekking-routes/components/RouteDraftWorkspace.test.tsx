import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
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
	it("edits the persisted draft and resumes preparation only after a successful save", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockResolvedValue({
			...route,
			name: "Updated ridge",
			updatedAt: "2026-09-02",
		});
		render(<RouteDraftWorkspace route={route} />);
		expect(screen.getByTestId("preparation")).toHaveTextContent("saved-id:draft");
		fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa tuyến nháp" }));
		expect(screen.queryByTestId("preparation")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Ridge");
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Updated ridge" } });
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() =>
			expect(trekkingRoutesService.updateDraft).toHaveBeenCalledWith("saved-id", {
				name: "Updated ridge",
				description: route.description,
				geometry: route.geometry,
				difficulty: "moderate",
				expectedDurationMinutes: 120,
			})
		);
		expect(await screen.findByTestId("preparation")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Updated ridge" })).toBeInTheDocument();
	});
	it("preserves edits on conflict and can cancel without another write", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockRejectedValue(
			new HttpError("Conflict", 409, null)
		);
		render(<RouteDraftWorkspace route={route} />);
		fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa tuyến nháp" }));
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Keep changes" } });
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Keep changes");
		fireEvent.click(screen.getByRole("button", { name: "Hủy chỉnh sửa" }));
		expect(trekkingRoutesService.updateDraft).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId("preparation")).toBeInTheDocument();
	});
	it.each(["pending_approval", "active", "closed"] as const)(
		"does not expose editing for %s",
		(status) => {
			render(<RouteDraftWorkspace route={{ ...route, status }} />);
			expect(
				screen.queryByRole("button", { name: "Chỉnh sửa tuyến nháp" })
			).not.toBeInTheDocument();
		}
	);
});
