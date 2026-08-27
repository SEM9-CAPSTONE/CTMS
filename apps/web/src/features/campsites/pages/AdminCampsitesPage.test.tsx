import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite } from "../types";
import { AdminCampsitesPage } from "./AdminCampsitesPage";

vi.mock("../services/campsites.service", () => ({
	campsitesService: {
		getPendingReview: vi.fn(),
		review: vi.fn(),
	},
}));

const mockCampsite: CreatedCampsite = {
	id: "campsite-1",
	hostId: "host-1",
	name: "Bãi cắm trại hồ Tuyền Lâm",
	description: "Khu cắm trại ven hồ thoáng mát",
	latitude: 11.89,
	longitude: 108.45,
	province: "Lâm Đồng",
	policies: { rules: "No littering" },
	operatingHours: { opensAt: "08:00", closesAt: "18:00" },
	status: "pending_approval",
	media: [{ id: "media-1", url: "http://example.com/campsite.jpg", type: "photo", sortOrder: 0 }],
	createdAt: "2026-08-25T12:00:00.000Z",
	updatedAt: "2026-08-25T12:00:00.000Z",
};

describe("AdminCampsitesPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(campsitesService.getPendingReview).mockResolvedValue([mockCampsite]);
	});

	it("renders pending campsites correctly", async () => {
		render(<AdminCampsitesPage />);

		expect(await screen.findByText("Bãi cắm trại hồ Tuyền Lâm")).toBeInTheDocument();
		expect(screen.getByText("Lâm Đồng")).toBeInTheDocument();
		expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
	});

	it("shows empty state when no pending campsites are found", async () => {
		vi.mocked(campsitesService.getPendingReview).mockResolvedValue([]);
		render(<AdminCampsitesPage />);

		expect(await screen.findByText("Chưa có bãi cắm nào được đăng ký")).toBeInTheDocument();
	});

	it("shows error alert and reload button when API fails to load data", async () => {
		vi.mocked(campsitesService.getPendingReview).mockRejectedValue(
			new HttpError("Internal Server Error", 500, {})
		);
		render(<AdminCampsitesPage />);

		expect(await screen.findByRole("alert")).toHaveTextContent("Lỗi hệ thống");
		const reloadBtn = screen.getByRole("button", { name: /Thử lại/ });
		expect(reloadBtn).toBeInTheDocument();
	});

	it("opens review dialog and submits approval successfully", async () => {
		const user = userEvent.setup();
		vi.mocked(campsitesService.review).mockResolvedValue({
			...mockCampsite,
			status: "active",
		});

		render(<AdminCampsitesPage />);
		const reviewBtn = await screen.findByRole("button", {
			name: /Duyệt Bãi cắm trại hồ Tuyền Lâm/,
		});
		await user.click(reviewBtn);

		expect(await screen.findByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Phê duyệt")).toBeInTheDocument();

		const confirmBtn = screen.getByRole("button", { name: "Xác nhận duyệt" });
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(campsitesService.review).toHaveBeenCalledWith("campsite-1", {
				action: "approve",
				reason: undefined,
			});
		});

		expect(await screen.findByText(/Đã phê duyệt hoạt động/)).toBeInTheDocument();
	});

	it("requires reason when action is decline", async () => {
		const user = userEvent.setup();
		render(<AdminCampsitesPage />);

		const reviewBtn = await screen.findByRole("button", {
			name: /Duyệt Bãi cắm trại hồ Tuyền Lâm/,
		});
		await user.click(reviewBtn);

		const declineBtn = screen.getByRole("button", { name: "Từ chối" });
		await user.click(declineBtn);

		const confirmDeclineBtn = screen.getByRole("button", { name: "Xác nhận từ chối" });
		await user.click(confirmDeclineBtn);

		expect(await screen.findByText("Lý do từ chối là bắt buộc.")).toBeInTheDocument();
		expect(campsitesService.review).not.toHaveBeenCalled();
	});

	it("declines campsite with a valid reason successfully", async () => {
		const user = userEvent.setup();
		vi.mocked(campsitesService.review).mockResolvedValue({
			...mockCampsite,
			status: "draft",
		});

		render(<AdminCampsitesPage />);
		const reviewBtn = await screen.findByRole("button", {
			name: /Duyệt Bãi cắm trại hồ Tuyền Lâm/,
		});
		await user.click(reviewBtn);

		const declineBtn = screen.getByRole("button", { name: "Từ chối" });
		await user.click(declineBtn);

		const reasonTextarea = screen.getByPlaceholderText(/Nhập lý do chi tiết từ chối/);
		await user.type(reasonTextarea, "Safety issues detected");

		const confirmDeclineBtn = screen.getByRole("button", { name: "Xác nhận từ chối" });
		await user.click(confirmDeclineBtn);

		await waitFor(() => {
			expect(campsitesService.review).toHaveBeenCalledWith("campsite-1", {
				action: "decline",
				reason: "Safety issues detected",
			});
		});

		expect(await screen.findByText(/Đã từ chối và trả khu cắm trại/)).toBeInTheDocument();
	});

	it("preserves reason text when server reports a conflict error", async () => {
		const user = userEvent.setup();
		vi.mocked(campsitesService.review).mockRejectedValue(
			new HttpError("Conflict", 409, { message: "State changed" })
		);

		render(<AdminCampsitesPage />);
		const reviewBtn = await screen.findByRole("button", {
			name: /Duyệt Bãi cắm trại hồ Tuyền Lâm/,
		});
		await user.click(reviewBtn);

		const declineBtn = screen.getByRole("button", { name: "Từ chối" });
		await user.click(declineBtn);

		const reasonTextarea = screen.getByPlaceholderText(/Nhập lý do chi tiết từ chối/);
		await user.type(reasonTextarea, "Keep this reason text");

		const confirmDeclineBtn = screen.getByRole("button", { name: "Xác nhận từ chối" });
		await user.click(confirmDeclineBtn);

		expect(await screen.findByRole("alert")).toHaveTextContent("State changed");
		expect(reasonTextarea).toHaveValue("Keep this reason text");
	});
});
