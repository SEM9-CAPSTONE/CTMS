import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import { campsitesService } from "../../campsites/services/campsites.service";
import type { CreatedCampsite } from "../../campsites/types";
import { RoleLandingPage } from "./RoleLandingPage";

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn() },
}));
vi.mock("../../campsites/services/campsites.service", () => ({
	campsitesService: { getMine: vi.fn() },
}));

const campsite: CreatedCampsite = {
	id: "11111111-1111-4111-8111-111111111111",
	hostId: "host-id",
	name: "Owned Da Nang Camp",
	description: "Host-owned campsite",
	latitude: 16.0544,
	longitude: 108.2022,
	province: "Đà Nẵng",
	policies: null,
	operatingHours: null,
	status: "draft",
	media: [],
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
};

describe("RoleLandingPage Host campsite actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(camperProfileService.getProfile).mockRejectedValue(new Error("profile unavailable"));
		vi.mocked(campsitesService.getMine).mockResolvedValue([campsite]);
	});

	it("keeps edit and adds create/view route actions scoped to the campsite id", async () => {
		const onEditCampsite = vi.fn();
		const onCreateTrekkingRoute = vi.fn();
		const onViewTrekkingRoutes = vi.fn();
		const user = userEvent.setup();
		render(
			<RoleLandingPage
				user={{
					id: "host-id",
					email: "host@example.com",
					phone: null,
					role: "host",
					roles: ["host"],
					status: "active",
					createdAt: "2026-08-25T00:00:00.000Z",
				}}
				roles={["host"]}
				onBackHome={vi.fn()}
				onEditCampsite={onEditCampsite}
				onCreateTrekkingRoute={onCreateTrekkingRoute}
				onViewTrekkingRoutes={onViewTrekkingRoutes}
			/>
		);

		const nameCell = await screen.findByText(campsite.name);
		const row = nameCell.closest("tr");
		expect(row).not.toBeNull();
		if (!row) throw new Error("Expected campsite row");
		const actions = within(row);

		await user.click(actions.getByRole("button", { name: "Tạo trekking route" }));
		expect(onCreateTrekkingRoute).toHaveBeenCalledWith(campsite.id);

		await user.click(actions.getByRole("button", { name: "Xem tuyến đường" }));
		expect(onViewTrekkingRoutes).toHaveBeenCalledWith(campsite.id);

		await user.click(actions.getByRole("button", { name: "Sửa khu cắm trại" }));
		expect(onEditCampsite).toHaveBeenCalledWith(campsite.id);
		await waitFor(() => expect(campsitesService.getMine).toHaveBeenCalledTimes(1));
	}, 15000);
});
