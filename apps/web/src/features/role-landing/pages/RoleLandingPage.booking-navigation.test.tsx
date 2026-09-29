import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { RoleLandingPage } from "./RoleLandingPage";

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn().mockResolvedValue(null) },
}));

const camper = {
	id: "camper-1",
	email: "camper@example.com",
	phone: null,
	role: "camper",
	roles: ["camper"],
	status: "active",
	createdAt: "2026-01-01T00:00:00.000Z",
} as StoredAuthUser;

describe("RoleLandingPage Booking navigation", () => {
	it("delegates the Camper sidebar Booking action", () => {
		const onNavigateToBookings = vi.fn();
		render(
			<RoleLandingPage
				user={camper}
				roles={["camper"]}
				onBackHome={() => {}}
				onNavigateToBookings={onNavigateToBookings}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Đơn đặt chỗ" }));
		expect(onNavigateToBookings).toHaveBeenCalledTimes(1);
	});
});
