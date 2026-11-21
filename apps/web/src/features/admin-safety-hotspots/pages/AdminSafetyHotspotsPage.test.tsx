import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { toast } from "../../../shared/components";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { SafetyHotspot } from "../types";
import { AdminSafetyHotspotsPage } from "./AdminSafetyHotspotsPage";

const HOTSPOT_ID = "8b1f6a52-2f6c-4c55-9f0e-6d2c1a9b7e10";

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
	name: null,
	description: null,
	severity: null,
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

describe("AdminSafetyHotspotsPage", () => {
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
		vi.spyOn(safetyHotspotsService, "actions").mockResolvedValue([]);
		vi.spyOn(safetyHotspotsService, "reviews").mockResolvedValue([]);
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

	it("no longer offers updating Route safety data from a hotspot", async () => {
		const dialog = await openDetail();
		await dialog.findByRole("region", { name: "Thông tin điểm nóng" });
		expect(dialog.queryByText("Cập nhật dữ liệu an toàn")).toBeNull();
		expect(dialog.queryByText(/chưa thể cập nhật dữ liệu an toàn/)).toBeNull();
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

	it("saves the name, description and severity an Admin writes", async () => {
		const update = vi.spyOn(safetyHotspotsService, "update").mockResolvedValue({
			...confirmed,
			name: "Ngã ba suối Đá",
			description: "Các đoàn rẽ nhầm xuống suối khi biển chỉ hướng bị cây che.",
			severity: "high",
		});
		const dialog = await openDetail();
		await userEvent.type(dialog.getByLabelText("Tên điểm nóng"), "  Ngã ba suối Đá ");
		await userEvent.type(
			dialog.getByLabelText("Mô tả"),
			"Các đoàn rẽ nhầm xuống suối khi biển chỉ hướng bị cây che."
		);
		await userEvent.click(dialog.getByRole("combobox", { name: "Mức độ" }));
		await userEvent.click(dialog.getByRole("option", { name: "Cao" }));
		await userEvent.click(dialog.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() =>
			expect(update).toHaveBeenCalledWith(HOTSPOT_ID, {
				name: "Ngã ba suối Đá",
				description: "Các đoàn rẽ nhầm xuống suối khi biển chỉ hướng bị cây che.",
				severity: "high",
			})
		);
		expect(toast.success).toHaveBeenCalledWith("Đã lưu thông tin điểm nóng.", "Điểm nóng an toàn");
		expect(await screen.findByRole("heading", { name: "Ngã ba suối Đá" })).toBeInTheDocument();
	});

	it("requires a name before saving", async () => {
		const update = vi.spyOn(safetyHotspotsService, "update");
		const dialog = await openDetail();
		await userEvent.type(dialog.getByLabelText("Mô tả"), "Đoạn dốc trơn sau mưa.");
		await userEvent.click(dialog.getByRole("button", { name: "Lưu thay đổi" }));
		expect(await dialog.findByText("Vui lòng nhập tên điểm nóng.")).toBeInTheDocument();
		expect(update).not.toHaveBeenCalled();
	});

	it("deletes a hotspot permanently only after confirmation", async () => {
		const remove = vi.spyOn(safetyHotspotsService, "remove").mockResolvedValue(undefined);
		const dialog = await openDetail();
		await userEvent.click(dialog.getByRole("button", { name: "Xóa điểm nóng" }));
		const confirmation = within(await screen.findByTestId("confirm-modal"));
		expect(confirmation.getByText(/xóa vĩnh viễn, không thể khôi phục/)).toBeInTheDocument();
		expect(remove).not.toHaveBeenCalled();
		await userEvent.click(confirmation.getByRole("button", { name: "Xóa vĩnh viễn" }));
		await waitFor(() => expect(remove).toHaveBeenCalledWith(HOTSPOT_ID));
		expect(toast.success).toHaveBeenCalledWith("Đã xóa điểm nóng.", "Điểm nóng an toàn");
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(safetyHotspotsService.list).toHaveBeenCalledTimes(2);
	});

	it("explains in Vietnamese why a hotspot that changed Route data cannot be deleted", async () => {
		vi.spyOn(safetyHotspotsService, "remove").mockRejectedValue(
			new HttpError("Conflict", 409, { code: "HOTSPOT_HAS_CORRECTIONS" })
		);
		const dialog = await openDetail();
		await userEvent.click(dialog.getByRole("button", { name: "Xóa điểm nóng" }));
		await userEvent.click(await screen.findByRole("button", { name: "Xóa vĩnh viễn" }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"Điểm nóng này đã được dùng để cập nhật dữ liệu an toàn của tuyến nên không thể xóa.",
				"Điểm nóng an toàn"
			)
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});

	it.each(["DETECTED", "UNDER_REVIEW"] as const)(
		"confirms a %s hotspot directly with a reason and confirmation",
		async (status) => {
			vi.mocked(safetyHotspotsService.list).mockResolvedValue([{ ...confirmed, status }]);
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
			expect(dialog.queryByRole("button", { name: "Bắt đầu xem xét" })).not.toBeInTheDocument();
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
		}
	);

	it.each(["DETECTED", "UNDER_REVIEW"] as const)(
		"dismisses a %s hotspot directly and keeps the reason",
		async (status) => {
			vi.mocked(safetyHotspotsService.list).mockResolvedValue([{ ...confirmed, status }]);
			const review = vi
				.spyOn(safetyHotspotsService, "review")
				.mockResolvedValue({ ...confirmed, status: "DISMISSED" });
			const dialog = await openDetail();
			expect(dialog.queryByRole("button", { name: "Bắt đầu xem xét" })).not.toBeInTheDocument();
			await userEvent.click(dialog.getByRole("button", { name: "Bác bỏ" }));
			expect(await dialog.findByText("Lý do cần tối thiểu 10 ký tự.")).toBeInTheDocument();
			expect(review).not.toHaveBeenCalled();
			const reason = "Đoàn rẽ xuống điểm nghỉ đã được Host kiểm tra, không có nguy hiểm tại đây.";
			await userEvent.type(
				dialog.getByLabelText("Lý do", { selector: "#hotspot-review-reason" }),
				reason
			);
			await userEvent.click(dialog.getByRole("button", { name: "Bác bỏ" }));
			const confirmation = within(await screen.findByTestId("confirm-modal"));
			expect(confirmation.getByText("Bác bỏ điểm nóng")).toBeInTheDocument();
			expect(review).not.toHaveBeenCalled();
			await userEvent.click(confirmation.getByRole("button", { name: "Bác bỏ" }));
			await waitFor(() => expect(review).toHaveBeenCalledWith(HOTSPOT_ID, "DISMISSED", reason));
			expect(review).toHaveBeenCalledOnce();
			expect(toast.success).toHaveBeenCalledWith("Đã bác bỏ điểm nóng.", "Điểm nóng an toàn");
		}
	);
});
