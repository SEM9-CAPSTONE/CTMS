import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import { HostProposalModal } from "./HostProposalModal";

vi.mock("../../trekking-routes/utils/route-map", () => ({
	DEFAULT_ROUTE_CENTER: [108.28, 16.12],
	getRouteMapStyleUrl: () => undefined,
}));

const route = {
	id: "c4a2e1f0-1111-4222-8333-944455556666",
	name: "Khám phá bán đảo Sơn Trà",
	status: "active",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.26, 16.11],
			[108.28, 16.12],
			[108.3, 16.11],
		],
	},
} as CreatedTrekkingRoute;

afterEach(() => vi.restoreAllMocks());

describe("Host proposal location selection on the actual map", () => {
	it("shows and moves the selected point, previews the entered radius and submits the last location", async () => {
		const create = vi
			.spyOn(dangerZoneProposalsService, "create")
			.mockResolvedValue({} as Awaited<ReturnType<typeof dangerZoneProposalsService.create>>);
		const onCreated = vi.fn();
		render(<HostProposalModal route={route} onClose={vi.fn()} onCreated={onCreated} />);
		const dialog = within(screen.getByRole("dialog"));
		const map = dialog.getByRole("img", { name: "Bản đồ chọn điểm nguy hiểm" });
		vi.spyOn(map, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 100,
			height: 100,
			right: 100,
			bottom: 100,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
		fireEvent.click(map, { clientX: 50, clientY: 50 });
		const marker = dialog.getByTestId("selected-hazard-marker");
		expect(Number(marker.getAttribute("cx"))).toBeCloseTo(50);
		expect(Number(marker.getAttribute("cy"))).toBeCloseTo(50);
		const preview = dialog.getByTestId("proposed-hazard-preview");
		const initialRadius = preview.getAttribute("points");
		fireEvent.change(dialog.getByLabelText("Bán kính (m)"), { target: { value: "80" } });
		expect(preview.getAttribute("points")).not.toBe(initialRadius);

		fireEvent.click(map, { clientX: 75, clientY: 25 });
		expect(dialog.getAllByTestId("selected-hazard-marker")).toHaveLength(1);
		expect(Number(marker.getAttribute("cx"))).toBeCloseTo(75);
		expect(Number(marker.getAttribute("cy"))).toBeCloseTo(25);
		await userEvent.type(dialog.getByLabelText("Mô tả"), "Đoạn dốc có đá rời, dễ trượt sau mưa.");
		await userEvent.click(dialog.getByRole("button", { name: "Gửi đề xuất" }));
		await waitFor(() => expect(create).toHaveBeenCalledOnce());
		expect(create).toHaveBeenCalledWith(
			route.id,
			expect.objectContaining({
				radiusMeters: 80,
				geometry: {
					type: "Point",
					coordinates: [expect.closeTo(108.2916), expect.closeTo(16.118)],
				},
			})
		);
		expect(onCreated).toHaveBeenCalledOnce();
	});
});
