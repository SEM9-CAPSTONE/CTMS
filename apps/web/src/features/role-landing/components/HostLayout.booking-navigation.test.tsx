import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import { HostLayout } from "./HostLayout";

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn() },
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
});
