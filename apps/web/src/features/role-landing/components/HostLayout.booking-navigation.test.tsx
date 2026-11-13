import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import { HostLayout } from "./HostLayout";

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn() },
}));

vi.mock("../../trips/hooks/usePorterRequests", () => ({
	useMyPorterRequests: vi.fn(() => ({ data: [] })),
}));

function storeCamper() {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: "camper-1",
			email: "camper@example.com",
			role: "camper",
			roles: ["camper"],
			status: "active",
			createdAt: "2026-01-01T00:00:00.000Z",
		})
	);
}

function storeHost() {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: "host-1",
			email: "host@example.com",
			role: "host",
			roles: ["host"],
			status: "active",
			createdAt: "2026-01-01T00:00:00.000Z",
		})
	);
}

describe("HostLayout Booking navigation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		storeCamper();
		vi.mocked(camperProfileService.getProfile).mockResolvedValue(null as never);
	});

	it("navigates the Camper sidebar to the Booking list", async () => {
		window.history.replaceState({}, "", "/trips");
		render(<HostLayout>Content</HostLayout>);
		fireEvent.click(screen.getByRole("button", { name: "Đơn đặt chỗ" }));
		expect(window.location.pathname).toBe("/bookings");
		await waitFor(() => expect(camperProfileService.getProfile).toHaveBeenCalledTimes(1));
	});

	it.each(["/bookings", "/bookings/booking-1"])(
		"derives the active Booking item from %s",
		(path) => {
			window.history.replaceState({}, "", path);
			render(<HostLayout>Content</HostLayout>);
			expect(screen.getByRole("button", { name: "Đơn đặt chỗ" })).toHaveClass("bg-[#164027]");
		}
	);

	it("navigates the Host sidebar to Porter management", async () => {
		localStorage.clear();
		storeHost();
		window.history.replaceState({}, "", "/dashboard");
		render(<HostLayout>Content</HostLayout>);
		fireEvent.click(screen.getByRole("button", { name: "Người hỗ trợ" }));
		expect(window.location.pathname).toBe("/host/porter");
		await waitFor(() => expect(camperProfileService.getProfile).toHaveBeenCalledTimes(1));
	});

	it.each(["host", "porter"] as const)("keeps the %s icon rail after remounting", (role) => {
		storeHost();
		window.history.replaceState({}, "", "/dashboard");
		const { unmount } = render(<HostLayout activeRole={role}>Content</HostLayout>);
		fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
		unmount();

		render(<HostLayout activeRole={role}>Content</HostLayout>);
		expect(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" })).toBeVisible();
		const overviewLabel = role === "host" ? "Tổng quan vận hành" : "Tổng quan";
		expect(screen.getByRole("button", { name: overviewLabel })).toHaveAttribute(
			"data-icon-only",
			"true"
		);
	});

	it("opens the Host Porter submenu in a flyout when collapsed", () => {
		storeHost();
		window.history.replaceState({}, "", "/dashboard");
		render(<HostLayout>Content</HostLayout>);
		fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
		const group = screen.getByRole("button", { name: "Người hỗ trợ" });
		fireEvent.click(group);
		expect(group).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(screen.getByRole("button", { name: "Yêu cầu đã gửi" }));
		expect(window.location.pathname + window.location.search).toBe("/host/porter?view=requests");
		expect(group).toHaveAttribute("aria-expanded", "false");
	});

	it("opens the mobile drawer with one sidebar and closes it after navigation", () => {
		storeHost();
		window.history.replaceState({}, "", "/dashboard");
		render(<HostLayout allowMobile>Content</HostLayout>);
		const menu = screen.getByRole("button", { name: "Mở menu" });
		fireEvent.click(menu);
		expect(menu).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("dialog", { name: "Chủ chuyến" })).toHaveAttribute(
			"aria-modal",
			"true"
		);
		expect(screen.getByRole("button", { name: "Đóng menu" })).toHaveFocus();
		expect(screen.getByText("Content").closest("[inert]")).not.toBeNull();
		expect(screen.getAllByRole("complementary")).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: "Tổng quan vận hành" }));
		expect(menu).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByText("Content").closest("[inert]")).toBeNull();
		expect(menu).toHaveFocus();
	});

	it("navigates the Host sidebar to Campers and Bookings management", async () => {
		localStorage.clear();
		storeHost();
		window.history.replaceState({}, "", "/dashboard");
		render(<HostLayout>Content</HostLayout>);
		fireEvent.click(screen.getByRole("button", { name: "Người tham gia & đặt chỗ" }));
		expect(window.location.pathname).toBe("/host/campers");
		await waitFor(() => expect(camperProfileService.getProfile).toHaveBeenCalledTimes(1));
	});

	it.each(["/host/campers", "/host/campers?tripId=trip-1"])(
		"derives the active Campers and Bookings item from %s",
		(path) => {
			localStorage.clear();
			storeHost();
			window.history.replaceState({}, "", path);
			render(<HostLayout>Content</HostLayout>);
			expect(screen.getByRole("button", { name: "Người tham gia & đặt chỗ" })).toHaveAttribute(
				"aria-current",
				"page"
			);
		}
	);
});
