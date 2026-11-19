import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { porterProfileService } from "../services/porter-profile.service";
import { PorterProfilePage } from "./PorterProfilePage";

vi.mock("../../porter-levels/components/PorterLevelRequestsPanel", () => ({
	PorterLevelRequestsPanel: () => <div data-testid="mock-level-requests-panel" />,
}));

vi.mock("../../porter-certificates/components/PorterCertificatesSection", () => ({
	PorterCertificatesSection: () => <div data-testid="mock-certificates-section" />,
}));

describe("PorterProfilePage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders full page with profile header, certificates, level requests, and led trip history", async () => {
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
		vi.spyOn(porterProfileService, "getLedTripHistory").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
		});

		render(<PorterProfilePage />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Hồ sơ người hỗ trợ" })).toBeVisible();
		});

		expect(screen.getByTestId("mock-certificates-section")).toBeVisible();
		expect(screen.getByTestId("porter-competency-section")).toBeVisible();
		expect(screen.getByTestId("porter-led-trip-history")).toBeVisible();
		expect(screen.getByTestId("readonly-rating-card")).toHaveTextContent("4.7");
		expect(screen.getByTestId("readonly-completed-trips-card")).toHaveTextContent("8");
	});

	it("refreshes profile and led trip history when clicking refresh button", async () => {
		const user = userEvent.setup();
		const mockProfile = {
			porterId: "porter-123",
			experienceYears: 3,
			certifications: [],
			languages: [],
			availabilityStatus: "available" as const,
			ratingAvg: 5.0,
			completedTrips: 12,
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const getProfileSpy = vi
			.spyOn(porterProfileService, "getProfile")
			.mockResolvedValue(mockProfile);
		const getLedSpy = vi.spyOn(porterProfileService, "getLedTripHistory").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
		});

		render(<PorterProfilePage />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Hồ sơ người hỗ trợ" })).toBeVisible();
		});

		const refreshButton = screen.getByRole("button", { name: /Làm mới/i });
		await user.click(refreshButton);

		await waitFor(() => {
			expect(getProfileSpy).toHaveBeenCalledTimes(2);
			expect(getLedSpy).toHaveBeenCalledTimes(2);
		});
	});
});
