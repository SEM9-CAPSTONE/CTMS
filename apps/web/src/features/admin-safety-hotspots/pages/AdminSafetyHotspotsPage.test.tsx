import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { toast } from "../../../shared/components";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { CorrectiveTargets, SafetyHotspot } from "../types";
import { AdminSafetyHotspotsPage } from "./AdminSafetyHotspotsPage";

const HOTSPOT_ID = "8b1f6a52-2f6c-4c55-9f0e-6d2c1a9b7e10";
const CHECKPOINT_ID = "0f5d2c9a-71b4-4f3e-8a6d-3c2b1e0f9a87";

const confirmed: SafetyHotspot = {
	id: HOTSPOT_ID,
	routeId: "c4a2e1f0-1111-4222-8333-944455556666",
	routeName: "Khám phá bán đảo Sơn Trà",
	status: "CONFIRMED",
	statusChangedAt: "2026-11-10T03:00:00Z",
	centerLat: 16.06,
	centerLng: 108.24,
	radiusMeters: 50,
	eventCount: 6,
	distinctTripCount: 4,
	distinctMemberCount: 5,
	firstEventAt: "2026-10-20T02:00:00Z",
	lastEventAt: "2026-11-08T02:00:00Z",
	detectedAt: "2026-11-09T00:00:00Z",
};
const targets: CorrectiveTargets = {
	checkpoints: [
		{ id: CHECKPOINT_ID, name: "Ngã ba suối Đá", routePosition: 0.5, instructions: "Nghỉ chân" },
	],
	hazardAreas: [],
};

async function openDetail() {
	render(<AdminSafetyHotspotsPage />);
	await userEvent.click(
		await screen.findByRole("button", {
			name: /Xem điểm nóng trên tuyến Khám phá bán đảo Sơn Trà/,
		})
	);
	return within(await screen.findByRole("dialog"));
}

describe("AdminSafetyHotspotsPage (CTMS-118)", () => {
	beforeEach(() => {
		vi.spyOn(safetyHotspotsService, "list").mockResolvedValue([confirmed]);
		vi.spyOn(safetyHotspotsService, "evidence").mockResolvedValue([
			{
				id: "event-1",
				tripTitle: "Khám phá bán đảo Sơn Trà",
				tripStartsAt: "2026-10-20T00:00:00Z",
				startedAt: "2026-10-20T02:00:00Z",
				endedAt: "2026-10-20T02:09:00Z",
				maxDistanceMeters: 72,
			},
			{
				id: "event-2",
				tripTitle: "Khám phá bán đảo Sơn Trà",
				tripStartsAt: "2026-11-08T00:00:00Z",
				startedAt: "2026-11-08T02:00:00Z",
				endedAt: "2026-11-08T02:12:00Z",
				maxDistanceMeters: 90,
			},
		]);
		vi.spyOn(safetyHotspotsService, "targets").mockResolvedValue(targets);
		vi.spyOn(safetyHotspotsService, "actions").mockResolvedValue([]);
		vi.spyOn(safetyHotspotsService, "reviews").mockResolvedValue([]);
		vi.spyOn(safetyHotspotsService, "createAction").mockResolvedValue({
			id: "action-1",
			actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
			targetName: "Ngã ba suối Đá",
			reason: "Nhiều đoàn rẽ nhầm tại ngã ba suối, cần chỉ rõ hướng rẽ trái.",
			packageImpact: "AFFECTED",
			impactTripCount: 2,
			actorName: "Trần Minh Quân",
			createdAt: "2026-11-15T03:00:00Z",
		});
		vi.spyOn(toast, "success").mockImplementation(() => undefined);
		vi.spyOn(toast, "error").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists confirmed hotspots by default with the Route name and no internal ids", async () => {
		render(<AdminSafetyHotspotsPage />);
		expect(await screen.findByText("Khám phá bán đảo Sơn Trà")).toBeInTheDocument();
		expect(safetyHotspotsService.list).toHaveBeenCalledWith("CONFIRMED");
		expect(document.body.textContent).not.toContain(HOTSPOT_ID);
	});

	it("reloads the list when another status is selected", async () => {
		render(<AdminSafetyHotspotsPage />);
		await screen.findByText("Khám phá bán đảo Sơn Trà");
		await userEvent.click(screen.getByRole("button", { name: "Đang xem xét" }));
		await waitFor(() =>
			expect(safetyHotspotsService.list).toHaveBeenLastCalledWith("UNDER_REVIEW")
		);
		await userEvent.click(screen.getByRole("button", { name: "Tất cả" }));
		await waitFor(() => expect(safetyHotspotsService.list).toHaveBeenLastCalledWith("ALL"));
	});

	it("does not offer a safety update for a hotspot that is not confirmed", async () => {
		vi.mocked(safetyHotspotsService.list).mockResolvedValue([
			{ ...confirmed, status: "UNDER_REVIEW" },
		]);
		const dialog = await openDetail();
		expect(
			dialog.getByText("Điểm nóng chưa được xác nhận nên chưa thể cập nhật dữ liệu an toàn.")
		).toBeInTheDocument();
		expect(dialog.queryByRole("button", { name: "Cập nhật dữ liệu an toàn" })).toBeNull();
		expect(safetyHotspotsService.targets).not.toHaveBeenCalled();
	});

	it("lists each deviation with its Trip and time, without member data", async () => {
		const dialog = await openDetail();
		const section = within(await dialog.findByRole("region", { name: "Các lần lệch tuyến" }));
		expect(
			await section.findByText(/Khám phá bán đảo Sơn Trà · khởi hành 20\/10\//)
		).toBeInTheDocument();
		expect(section.getByText(/Khám phá bán đảo Sơn Trà · khởi hành 0?8\/11\//)).toBeInTheDocument();
		expect(section.getByText(/lệch 9 phút, xa nhất 72 m/)).toBeInTheDocument();
		expect(section.getByText(/lệch 12 phút, xa nhất 90 m/)).toBeInTheDocument();
	});

	it("shows review decisions and data updates in one history table, newest first", async () => {
		vi.mocked(safetyHotspotsService.reviews).mockResolvedValue([
			{
				id: "review-1",
				fromStatus: "UNDER_REVIEW",
				toStatus: "CONFIRMED",
				reason: "Năm đoàn cùng lệch tuyến ở ngã ba suối Đá.",
				actorName: "Trần Minh Quân",
				createdAt: "2026-11-14T03:00:00Z",
			},
		]);
		vi.mocked(safetyHotspotsService.actions).mockResolvedValue([
			{
				id: "action-0",
				actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
				targetName: "Ngã ba suối Đá",
				reason: "Nhiều đoàn rẽ nhầm tại ngã ba suối, cần chỉ rõ hướng rẽ trái.",
				packageImpact: "AFFECTED",
				impactTripCount: 2,
				actorName: "Trần Minh Quân",
				createdAt: "2026-11-15T03:00:00Z",
			},
		]);
		const dialog = await openDetail();
		expect(dialog.getAllByRole("table")).toHaveLength(1);
		const table = await dialog.findByRole("table", { name: "Lịch sử điểm nóng" });
		await within(table).findByText("Đã xác nhận");
		const [, newest, older] = within(table).getAllByRole("row");
		expect(
			within(newest).getByText("Cập nhật hướng dẫn an toàn tại điểm dừng")
		).toBeInTheDocument();
		expect(
			within(newest).getByText("Ngã ba suối Đá · Gói an toàn mới cho 2 chuyến")
		).toBeInTheDocument();
		expect(within(newest).getByText("Trần Minh Quân")).toBeInTheDocument();
		expect(within(older).getByText("Đã xác nhận")).toBeInTheDocument();
		expect(
			within(older).getByText("Năm đoàn cùng lệch tuyến ở ngã ba suối Đá.")
		).toBeInTheDocument();
	});

	it("updates checkpoint instructions after confirmation and reports the package impact", async () => {
		const dialog = await openDetail();
		await userEvent.click(await dialog.findByRole("combobox", { name: "Điểm dừng" }));
		await userEvent.click(dialog.getByRole("option", { name: "1. Ngã ba suối Đá" }));
		const instructions = dialog.getByLabelText("Hướng dẫn an toàn mới");
		await userEvent.clear(instructions);
		await userEvent.type(instructions, "Rẽ trái theo cọc tiêu đỏ");
		await userEvent.type(
			dialog.getByLabelText("Lý do"),
			"Nhiều đoàn rẽ nhầm tại ngã ba suối, cần chỉ rõ hướng rẽ trái."
		);
		await userEvent.click(dialog.getByRole("button", { name: "Cập nhật dữ liệu an toàn" }));
		await userEvent.click(await screen.findByRole("button", { name: "Cập nhật" }));

		await waitFor(() =>
			expect(safetyHotspotsService.createAction).toHaveBeenCalledWith(HOTSPOT_ID, {
				actionType: "UPDATE_CHECKPOINT_INSTRUCTIONS",
				reason: "Nhiều đoàn rẽ nhầm tại ngã ba suối, cần chỉ rõ hướng rẽ trái.",
				checkpointId: CHECKPOINT_ID,
				instructions: "Rẽ trái theo cọc tiêu đỏ",
			})
		);
		expect(toast.success).toHaveBeenCalledWith(
			"Đã cập nhật dữ liệu an toàn. Gói an toàn ngoại tuyến của 2 chuyến sắp khởi hành sẽ được tạo phiên bản mới.",
			"Điểm nóng an toàn"
		);
	});

	it("requires a reason before asking for confirmation", async () => {
		const dialog = await openDetail();
		await dialog.findByRole("combobox", { name: "Điểm dừng" });
		await userEvent.click(dialog.getByRole("button", { name: "Cập nhật dữ liệu an toàn" }));
		expect(await dialog.findByText("Lý do cần tối thiểu 10 ký tự.")).toBeInTheDocument();
		expect(dialog.getByText("Chọn điểm dừng cần cập nhật.")).toBeInTheDocument();
		expect(safetyHotspotsService.createAction).not.toHaveBeenCalled();
	});

	it("shows a Vietnamese error toast when the hotspot is no longer confirmed", async () => {
		vi.mocked(safetyHotspotsService.createAction).mockRejectedValue(
			new HttpError("Conflict", 409, { code: "HOTSPOT_NOT_CONFIRMED", status: "DISMISSED" })
		);
		const dialog = await openDetail();
		await userEvent.click(await dialog.findByRole("combobox", { name: "Biện pháp" }));
		await userEvent.click(dialog.getByRole("option", { name: "Không cần thay đổi dữ liệu" }));
		await userEvent.type(
			dialog.getByLabelText("Lý do"),
			"Đoạn lệch là lối tắt an toàn đã có biển chỉ dẫn."
		);
		await userEvent.click(dialog.getByRole("button", { name: "Cập nhật dữ liệu an toàn" }));
		await userEvent.click(await screen.findByRole("button", { name: "Cập nhật" }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"Điểm nóng này không còn ở trạng thái đã xác nhận nên chưa thể cập nhật dữ liệu an toàn.",
				"Điểm nóng an toàn"
			)
		);
	});

	it("moves an under-review hotspot to confirmed only with a reason and confirmation", async () => {
		const underReview: SafetyHotspot = { ...confirmed, status: "UNDER_REVIEW" };
		vi.mocked(safetyHotspotsService.list).mockResolvedValue([underReview]);
		const review = vi
			.spyOn(safetyHotspotsService, "review")
			.mockResolvedValue({ ...confirmed, status: "CONFIRMED" });
		render(<AdminSafetyHotspotsPage />);
		await userEvent.click(
			await screen.findByRole("button", {
				name: /Xem điểm nóng trên tuyến Khám phá bán đảo Sơn Trà/,
			})
		);
		const dialog = within(await screen.findByRole("dialog"));
		await userEvent.click(dialog.getByRole("button", { name: "Xác nhận điểm nóng" }));
		expect(await dialog.findByText("Lý do cần tối thiểu 10 ký tự.")).toBeInTheDocument();
		expect(review).not.toHaveBeenCalled();

		await userEvent.type(
			dialog.getByLabelText("Lý do", { selector: "#hotspot-review-reason" }),
			"Năm đoàn cùng lệch tuyến ở ngã ba suối Đá."
		);
		await userEvent.click(dialog.getByRole("button", { name: "Xác nhận điểm nóng" }));
		await userEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
		await waitFor(() =>
			expect(review).toHaveBeenCalledWith(
				HOTSPOT_ID,
				"CONFIRMED",
				"Năm đoàn cùng lệch tuyến ở ngã ba suối Đá."
			)
		);
		expect(toast.success).toHaveBeenCalled();
	});
});
