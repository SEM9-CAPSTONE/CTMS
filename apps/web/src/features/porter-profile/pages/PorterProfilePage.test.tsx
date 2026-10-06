import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tripsService } from "../../trips/services/trips.service";
import { porterProfileService } from "../services/porter-profile.service";
import { PorterProfilePage } from "./PorterProfilePage";

describe("PorterProfilePage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders full page with profile header, form, and qualifications panel", async () => {
		const mockProfile = {
			porterId: "porter-123",
			experienceYears: 3,
			certifications: ["WFA"],
			languages: ["Vietnamese"],
			availabilityStatus: "available" as const,
			ratingAvg: 4.7,
			completedTrips: 8,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-02",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(mockProfile);
		vi.spyOn(porterProfileService, "getMyRouteQualifications").mockResolvedValue([]);
		vi.spyOn(tripsService, "search").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
		});

		render(<PorterProfilePage />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Hồ sơ nghề nghiệp Porter" })).toBeVisible();
		});

		expect(screen.getByTestId("porter-profile-form")).toBeVisible();
		expect(screen.getByTestId("porter-qualifications-panel")).toBeVisible();
		expect(screen.getByTestId("readonly-rating-card")).toHaveTextContent("4.7");
		expect(screen.getByTestId("readonly-completed-trips-card")).toHaveTextContent("8");
	});

	it("saves profile and displays success message", async () => {
		const user = userEvent.setup();
		const mockProfile = {
			porterId: "porter-123",
			experienceYears: 3,
			certifications: [],
			languages: [],
			availabilityStatus: "available" as const,
			ratingAvg: 0,
			completedTrips: 0,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		vi.spyOn(porterProfileService, "getProfile").mockResolvedValue(mockProfile);
		vi.spyOn(porterProfileService, "getMyRouteQualifications").mockResolvedValue([]);
		vi.spyOn(tripsService, "search").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
		});
		const updateSpy = vi.spyOn(porterProfileService, "updateProfile").mockResolvedValue({
			...mockProfile,
			experienceYears: 4,
			version: 2,
		});

		render(<PorterProfilePage />);

		await waitFor(() => {
			expect(screen.getByLabelText(/Số năm kinh nghiệm Porter/i)).toHaveValue(3);
		});

		const expInput = screen.getByLabelText(/Số năm kinh nghiệm Porter/i);
		await user.clear(expInput);
		await user.type(expInput, "4");

		await user.click(screen.getByTestId("save-porter-profile-button"));

		await waitFor(() => {
			expect(updateSpy).toHaveBeenCalled();
		});
		expect(screen.getByText("Hồ sơ Porter đã được lưu thành công!")).toBeVisible();
	});
});
