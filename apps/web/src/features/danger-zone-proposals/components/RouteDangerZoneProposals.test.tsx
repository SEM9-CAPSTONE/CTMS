import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "../../../shared/components";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import { RouteDangerZoneProposals } from "./RouteDangerZoneProposals";

vi.mock("../../trekking-routes/components/RouteCheckpointMap", () => ({
	RouteCheckpointMap: ({
		onSelectLocation,
	}: {
		onSelectLocation: (point: { type: "Point"; coordinates: [number, number] }) => void;
	}) => (
		<button
			type="button"
			onClick={() => onSelectLocation({ type: "Point", coordinates: [108.24, 16.061] })}
		>
			Chọn điểm trên bản đồ
		</button>
	),
}));

const route = {
	id: "c4a2e1f0-1111-4222-8333-944455556666",
	name: "Khám phá bán đảo Sơn Trà",
	status: "active",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.22, 16.06],
			[108.26, 16.06],
		],
	},
} as CreatedTrekkingRoute;

describe("RouteDangerZoneProposals", () => {
	beforeEach(() => {
		vi.spyOn(dangerZoneProposalsService, "listForRoute").mockResolvedValue([]);
		vi.spyOn(toast, "success").mockImplementation(() => undefined);
		vi.spyOn(toast, "error").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lets a Host on an active Route send a point proposal for Admin review", async () => {
		const create = vi
			.spyOn(dangerZoneProposalsService, "create")
			.mockResolvedValue({} as Awaited<ReturnType<typeof dangerZoneProposalsService.create>>);
		render(<RouteDangerZoneProposals route={route} />);
		await userEvent.click(await screen.findByRole("button", { name: "Thêm đề xuất" }));
		const dialog = within(await screen.findByRole("dialog"));

		await userEvent.type(dialog.getByLabelText("Mô tả"), "Dốc đất đỏ trơn trượt sau mưa");
		await userEvent.click(dialog.getByRole("button", { name: "Gửi đề xuất" }));
		expect(await dialog.findByText("Vui lòng chọn vị trí trên bản đồ.")).toBeInTheDocument();
		expect(create).not.toHaveBeenCalled();

		await userEvent.click(dialog.getByRole("button", { name: "Chọn điểm trên bản đồ" }));
		await userEvent.click(dialog.getByRole("button", { name: "Gửi đề xuất" }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith(route.id, {
				hazardType: "SLIPPERY_OR_LANDSLIDE",
				severity: "medium",
				description: "Dốc đất đỏ trơn trượt sau mưa",
				radiusMeters: 30,
				geometry: { type: "Point", coordinates: [108.24, 16.061] },
			})
		);
		expect(toast.success).toHaveBeenCalled();
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	});
});
