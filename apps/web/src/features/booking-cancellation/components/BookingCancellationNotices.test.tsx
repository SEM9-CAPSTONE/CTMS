import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bookingCancellationNoticesService } from "../services/booking-cancellation-notices.service";
import { BookingCancellationNotices } from "./BookingCancellationNotices";

vi.mock("../../auth/utils/tokenStorage", () => ({ getStoredAuthUser: () => ({ id: "host" }) }));
beforeEach(() => {
	localStorage.setItem("accessToken", "test-token");
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute("open");
	};
});
afterEach(() => {
	localStorage.removeItem("accessToken");
	vi.restoreAllMocks();
});
const notice = {
	id: "notice",
	bookingId: "booking",
	tripId: "trip",
	tripTitle: "Bidoup",
	camperName: "Camper A",
	reason: "Đổi ngày",
	createdAt: "2030-01-01T00:00:00Z",
	readAt: null,
};

it("shows reason, an authorized Trip reference and marks read only after server confirmation", async () => {
	const list = vi.spyOn(bookingCancellationNoticesService, "list").mockResolvedValue([notice]);
	const mark = vi.spyOn(bookingCancellationNoticesService, "markRead").mockResolvedValue(undefined);
	render(<BookingCancellationNotices />);
	fireEvent.click(screen.getByRole("button", { name: /Thông báo hủy đặt chỗ/ }));
	expect(await screen.findByText("Lý do: Đổi ngày")).toBeVisible();
	expect(screen.getByRole("link", { name: "Bidoup" })).toHaveAttribute("href", "/trips/trip");
	expect(screen.getByText(/1 chưa đọc/)).toBeVisible();
	list.mockResolvedValue([{ ...notice, readAt: "2030-01-01T01:00:00Z" }]);
	fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
	await waitFor(() => expect(mark).toHaveBeenCalledWith("notice", expect.anything()));
	expect(await screen.findByText(/0 chưa đọc/)).toBeVisible();
});

it("offers retry when the inbox request fails", async () => {
	vi.spyOn(bookingCancellationNoticesService, "list").mockRejectedValue(new Error("offline"));
	render(<BookingCancellationNotices />);
	fireEvent.click(screen.getByRole("button", { name: /Thông báo hủy đặt chỗ/ }));
	expect(await screen.findByRole("button", { name: /Không tải được thông báo/ })).toBeVisible();
});
