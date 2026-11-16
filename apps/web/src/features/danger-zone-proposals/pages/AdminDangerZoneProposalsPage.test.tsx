import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { toast } from "../../../shared/components";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import type { DangerZoneProposal } from "../types";
import { AdminDangerZoneProposalsPage } from "./AdminDangerZoneProposalsPage";

vi.mock("../../trekking-routes/components/RouteGeometryPreview", () => ({
	RouteGeometryPreview: () => <div data-testid="proposal-map" />,
}));

const PROPOSAL_ID = "5d0c4f1e-3a2b-4c1d-8e9f-0a1b2c3d4e5f";

const fromIncident: DangerZoneProposal = {
	id: PROPOSAL_ID,
	source: "INCIDENT",
	status: "PENDING",
	hazardType: "LOST_MEMBER",
	severity: "high",
	description: "Mất liên lạc với chị Ngọc Anh gần ngã ba suối Đá.",
	geometry: { type: "Point", coordinates: [108.241, 16.0605] },
	radiusMeters: 30,
	locationAccuracyMeters: 12,
	observedAt: "2026-11-16T03:00:00Z",
	createdAt: "2026-11-16T03:00:05Z",
	routeId: "c4a2e1f0-1111-4222-8333-944455556666",
	routeName: "Khám phá bán đảo Sơn Trà",
	routeGeometry: {
		type: "LineString",
		coordinates: [
			[108.22, 16.06],
			[108.26, 16.06],
		],
	},
	proposerName: "Nguyễn Văn Tài",
	tripTitle: "Sơn Trà bình minh",
	tripStartsAt: "2026-11-16T00:00:00Z",
	reviewerName: null,
	reviewedAt: null,
	reviewReason: null,
	dangerZoneId: null,
};

async function openDetail() {
	render(<AdminDangerZoneProposalsPage />);
	await userEvent.click(
		await screen.findByRole("button", {
			name: /Xem đề xuất nơi thành viên bị lạc trên tuyến Khám phá bán đảo Sơn Trà/,
		})
	);
	return within(await screen.findByRole("dialog"));
}

describe("AdminDangerZoneProposalsPage", () => {
	beforeEach(() => {
		vi.spyOn(dangerZoneProposalsService, "list").mockResolvedValue([fromIncident]);
		vi.spyOn(toast, "success").mockImplementation(() => undefined);
		vi.spyOn(toast, "error").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists pending proposals by default with readable source and no internal ids", async () => {
		render(<AdminDangerZoneProposalsPage />);
		expect(await screen.findByText("Nơi thành viên bị lạc")).toBeInTheDocument();
		expect(screen.getByText("Báo cáo sự cố")).toBeInTheDocument();
		expect(dangerZoneProposalsService.list).toHaveBeenCalledWith("PENDING");
		expect(document.body.textContent).not.toContain(PROPOSAL_ID);
	});

	it("does not copy a field report into the public description", async () => {
		const dialog = await openDetail();
		expect(dialog.getByText(fromIncident.description)).toBeInTheDocument();
		expect(dialog.getByLabelText("Mô tả hiển thị trên bản đồ")).toHaveValue("");
		expect(dialog.getByText(/Sơn Trà bình minh/)).toBeInTheDocument();
	});

	it("approves with the Admin's public description and radius after confirmation", async () => {
		const approve = vi
			.spyOn(dangerZoneProposalsService, "approve")
			.mockResolvedValue({ ...fromIncident, status: "APPROVED", reviewerName: "Trần Minh Quân" });
		const dialog = await openDetail();
		await userEvent.type(
			dialog.getByLabelText("Mô tả hiển thị trên bản đồ"),
			"Ngã ba dễ đi lạc, bám theo cọc tiêu đỏ"
		);
		const radius = dialog.getByLabelText("Bán kính ghi nhận (m)");
		await userEvent.clear(radius);
		await userEvent.type(radius, "60");
		await userEvent.click(dialog.getByRole("button", { name: "Duyệt và hiển thị" }));
		await userEvent.click(await screen.findByRole("button", { name: "Duyệt" }));

		await waitFor(() =>
			expect(approve).toHaveBeenCalledWith(PROPOSAL_ID, {
				severity: "high",
				description: "Ngã ba dễ đi lạc, bám theo cọc tiêu đỏ",
				radiusMeters: 60,
				reason: undefined,
			})
		);
		expect(toast.success).toHaveBeenCalled();
	});

	it("requires a reason before rejecting", async () => {
		const reject = vi
			.spyOn(dangerZoneProposalsService, "reject")
			.mockResolvedValue({ ...fromIncident, status: "REJECTED" });
		const dialog = await openDetail();
		await userEvent.click(dialog.getByRole("button", { name: "Từ chối" }));
		expect(await dialog.findByText("Lý do cần tối thiểu 10 ký tự.")).toBeInTheDocument();
		expect(reject).not.toHaveBeenCalled();

		await userEvent.type(
			dialog.getByLabelText("Lý do"),
			"Thành viên đã được tìm thấy, khu vực không nguy hiểm."
		);
		await userEvent.click(dialog.getByRole("button", { name: "Từ chối" }));
		const confirm = within(screen.getByTestId("confirm-modal-overlay"));
		await userEvent.click(confirm.getByRole("button", { name: "Từ chối" }));
		await waitFor(() =>
			expect(reject).toHaveBeenCalledWith(
				PROPOSAL_ID,
				"Thành viên đã được tìm thấy, khu vực không nguy hiểm."
			)
		);
	});

	it("shows a Vietnamese toast when the proposal was already decided", async () => {
		vi.spyOn(dangerZoneProposalsService, "approve").mockRejectedValue(
			new HttpError("Conflict", 409, { code: "PROPOSAL_ALREADY_DECIDED" })
		);
		const dialog = await openDetail();
		await userEvent.type(dialog.getByLabelText("Mô tả hiển thị trên bản đồ"), "Ngã ba dễ đi lạc");
		await userEvent.click(dialog.getByRole("button", { name: "Duyệt và hiển thị" }));
		await userEvent.click(await screen.findByRole("button", { name: "Duyệt" }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"Đề xuất đã được xử lý. Vui lòng tải lại danh sách.",
				"Đề xuất điểm nguy hiểm"
			)
		);
	});
});
