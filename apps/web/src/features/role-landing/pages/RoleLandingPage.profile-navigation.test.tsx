import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { RoleLandingPage } from "./RoleLandingPage";

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn() },
}));
vi.mock("../components/HostOperationalOverview", () => ({
	HostOperationalOverview: () => null,
}));
vi.mock("../components/HostMyTripsPanel", () => ({
	HostMyTripsPanel: () => null,
}));

const profile: CamperProfileData = {
	id: "profile-1",
	accountStatus: "active",
	fullName: "Porter Test",
	email: "porter@example.com",
	phone: "",
	avatarUrl: "/avatar.png",
	isProMember: false,
	joinedYear: 2026,
	dateOfBirth: "",
	gender: "other",
	address: "",
	bio: "",
	campingExperienceYears: 0,
	trekkingExperienceDetails: "",
	languages: [],
	emergencyContacts: [],
	completionPercentage: 100,
	emergencyContactAdded: false,
	phoneVerified: false,
};

function user(role: string, roles: string[]): StoredAuthUser {
	return {
		id: "user-1",
		email: "user@example.com",
		phone: null,
		role,
		roles,
		status: "active",
		createdAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("RoleLandingPage profile navigation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/dashboard");
		vi.mocked(camperProfileService.getProfile).mockResolvedValue(profile);
	});

	it("uses the selected Porter role for the dashboard sidebar Profile action", () => {
		const onOpenProfile = vi.fn();
		render(
			<RoleLandingPage
				user={user("host", ["host", "porter"])}
				roles={["host", "porter"]}
				onBackHome={() => {}}
				onOpenProfile={onOpenProfile}
			/>
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Porter" })[0]);
		fireEvent.click(screen.getByRole("button", { name: "Hồ sơ & Năng lực" }));

		expect(window.location.pathname).toBe("/porter/profile");
		expect(onOpenProfile).not.toHaveBeenCalled();
		expect(window.history.state).toMatchObject({ activeRole: "porter" });
	});

	it("uses the selected Porter role for the sidebar footer profile card", async () => {
		const onOpenProfile = vi.fn();
		render(
			<RoleLandingPage
				user={user("host", ["host", "porter"])}
				roles={["host", "porter"]}
				onBackHome={() => {}}
				onOpenProfile={onOpenProfile}
			/>
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Porter" })[0]);
		const profileButton = await screen.findByRole("button", { name: /Porter Test/ });
		fireEvent.click(profileButton);

		await waitFor(() => expect(window.location.pathname).toBe("/porter/profile"));
		expect(onOpenProfile).not.toHaveBeenCalled();
	});

	it("restores the active Porter role from browser history state", () => {
		window.history.replaceState({ activeRole: "porter" }, "", "/dashboard");
		render(
			<RoleLandingPage
				user={user("host", ["host", "porter"])}
				roles={["host", "porter"]}
				onBackHome={() => {}}
				onOpenProfile={() => {}}
			/>
		);

		expect(screen.getByText("Porter Ops")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Hồ sơ & Năng lực" })).toBeInTheDocument();
	});

	it("preserves Camper profile navigation", () => {
		const onOpenProfile = vi.fn();
		render(
			<RoleLandingPage
				user={user("camper", ["camper"])}
				roles={["camper"]}
				onBackHome={() => {}}
				onOpenProfile={onOpenProfile}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Hồ sơ & Cài đặt" }));

		expect(onOpenProfile).toHaveBeenCalledWith("camper");
	});
});
