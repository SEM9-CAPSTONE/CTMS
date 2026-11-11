import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteDangerZone, RouteDangerZoneGeometry, RouteMapMode } from "../types";
import { closePolygonRing } from "../utils/danger-zone-map";
import { CreateRouteDangerZoneForm } from "./CreateRouteDangerZoneForm";

const point = { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] };
const created: RouteDangerZone = {
	id: "zone-id",
	routeId: "route-id",
	geometry: point,
	radiusMeters: 30,
	description: "Loose rock",
	severity: "medium",
	createdAt: "2026-09-04T00:00:00.000Z",
	updatedAt: "2026-09-04T00:00:00.000Z",
};

function props() {
	return {
		mode: "hazard-point" as RouteMapMode,
		geometry: point as RouteDangerZoneGeometry,
		polygonVertexCount: 0,
		disabled: false,
		isSubmitting: false,
		error: "",
		polygonError: "",
		onSelectCheckpointType: vi.fn(),
		onFinishPolygon: vi.fn(),
		onUndoPolygon: vi.fn(),
		onClearGeometry: vi.fn(),
		onCancel: vi.fn(),
		onRadiusChange: vi.fn(),
		onSubmit: vi.fn(),
		onCreated: vi.fn(),
	};
}

describe("CreateRouteDangerZoneForm", () => {
	it("preserves Point values after failure and resets only after success", async () => {
		const user = userEvent.setup();
		const input = props();
		input.onSubmit.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
		render(<CreateRouteDangerZoneForm {...input} />);
		await user.clear(screen.getByLabelText("Bán kính vùng nguy hiểm (mét)"));
		await user.type(screen.getByLabelText("Bán kính vùng nguy hiểm (mét)"), "45.5");
		await user.type(screen.getByLabelText("Mô tả an toàn"), "Falling stones");
		await user.selectOptions(screen.getByLabelText("Mức độ nguy hiểm"), "high");
		await user.click(screen.getByRole("button", { name: "Tạo khu vực nguy hiểm" }));
		await waitFor(() => expect(input.onSubmit).toHaveBeenCalledTimes(1));
		expect(input.onSubmit).toHaveBeenLastCalledWith({
			geometry: point,
			radiusMeters: 45.5,
			description: "Falling stones",
			severity: "high",
		});
		expect(screen.getByLabelText("Mô tả an toàn")).toHaveValue("Falling stones");
		expect(input.onCreated).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Tạo khu vực nguy hiểm" }));
		await waitFor(() => expect(input.onCreated).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Mô tả an toàn")).toHaveValue("");
	});

	it("creates a Polygon without radius and exposes Finish/Undo/Clear/Cancel", async () => {
		const user = userEvent.setup();
		const input = props();
		const polygon = closePolygonRing([
			[108.45, 11.94],
			[108.46, 11.95],
			[108.47, 11.94],
		]);
		input.mode = "hazard-polygon";
		input.geometry = polygon ?? point;
		input.polygonVertexCount = 3;
		input.onSubmit.mockResolvedValue({ ...created, geometry: input.geometry, radiusMeters: null });
		render(<CreateRouteDangerZoneForm {...input} />);
		await user.click(screen.getByRole("button", { name: "Hoàn tất khu vực" }));
		await user.click(screen.getByRole("button", { name: "Hoàn tác đỉnh" }));
		await user.click(screen.getByRole("button", { name: "Xóa khu vực" }));
		expect(input.onFinishPolygon).toHaveBeenCalledTimes(1);
		expect(input.onUndoPolygon).toHaveBeenCalledTimes(1);
		expect(input.onClearGeometry).toHaveBeenCalledTimes(1);
		await user.type(screen.getByLabelText("Mô tả an toàn"), "Landslide boundary");
		await user.click(screen.getByRole("button", { name: "Tạo khu vực nguy hiểm" }));
		await waitFor(() =>
			expect(input.onSubmit).toHaveBeenCalledWith({
				geometry: input.geometry,
				description: "Landslide boundary",
				severity: "medium",
			})
		);
		await user.click(screen.getByRole("button", { name: "Hủy" }));
		expect(input.onCancel).toHaveBeenCalledTimes(1);
	});

	it("shows the Vị trí dropdown on Khu vực nguy hiểm and switches back to a route location", async () => {
		const user = userEvent.setup();
		const input = props();
		input.mode = "hazard-polygon";
		render(<CreateRouteDangerZoneForm {...input} />);
		expect(screen.getByLabelText("Vị trí")).toHaveValue("danger_area");
		expect(screen.queryByRole("button", { name: "Điểm nguy hiểm" })).not.toBeInTheDocument();
		await user.selectOptions(screen.getByLabelText("Vị trí"), "water");
		expect(input.onSelectCheckpointType).toHaveBeenCalledWith("water");
	});

	it("disables every creation action for a read-only Route", () => {
		const input = props();
		input.disabled = true;
		render(<CreateRouteDangerZoneForm {...input} />);
		expect(screen.getByLabelText("Vị trí")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Tạo khu vực nguy hiểm" })).toBeDisabled();
		expect(screen.getByLabelText("Mô tả an toàn")).toBeDisabled();
	});
});
