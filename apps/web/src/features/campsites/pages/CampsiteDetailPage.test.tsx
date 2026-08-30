import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import { campsitesService } from "../services/campsites.service";
import type { CampsiteDetail } from "../types";
import { CampsiteDetailPage } from "./CampsiteDetailPage";

vi.mock("../services/campsites.service", () => ({
	campsitesService: { getPublicDetail: vi.fn() },
}));

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn() },
}));

const mockedGetPublicDetail = vi.mocked(campsitesService.getPublicDetail);
const mockedGetProfile = vi.mocked(camperProfileService.getProfile);

const sampleCampsite: CampsiteDetail = {
	id: "11111111-1111-1111-1111-111111111111",
	name: "Da Lat Pine Camp",
	description: "Quiet pine forest near the lake",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lam Dong",
	policies: { rules: "No loud noises after 10 PM. Clean up trash." },
	operatingHours: { opensAt: "08:00", closesAt: "22:00" },
	seasonStartDate: "2026-06-01",
	seasonEndDate: "2026-09-30",
	maxAdvanceBookingDays: 30,
	minNights: 1,
	maxNights: 7,
	status: "active",
	media: [
		{ id: "media-1", url: "https://example.com/photo1.jpg", type: "photo", sortOrder: 0 },
		{ id: "media-2", url: "https://example.com/photo2.jpg", type: "photo", sortOrder: 1 },
	],
	upcomingTrips: [],
};

describe("CampsiteDetailPage", () => {
	beforeEach(() => {
		mockedGetPublicDetail.mockReset();
		mockedGetProfile.mockReset();
		mockedGetProfile.mockResolvedValue({
			id: "camper-1",
			accountStatus: "active",
			email: "camper@example.com",
			fullName: "Nguyen Camper",
			phone: "",
			avatarUrl: "https://example.com/avatar.jpg",
			isProMember: false,
			joinedYear: 2024,
			dateOfBirth: "",
			gender: "other",
			address: "",
			bio: "",
			campingExperienceYears: 0,
			trekkingExperienceDetails: "",
			languages: [],
			emergencyContacts: [],
			completionPercentage: 0,
			emergencyContactAdded: false,
			phoneVerified: false,
		});
	});

	it("shows the loading state initially", () => {
		mockedGetPublicDetail.mockImplementation(() => new Promise(() => {}));
		render(<CampsiteDetailPage campsiteId="1" />);
		expect(screen.queryByText("Da Lat Pine Camp")).not.toBeInTheDocument();
	});

	it("renders all details correctly for a valid active campsite", async () => {
		mockedGetPublicDetail.mockResolvedValue(sampleCampsite);
		render(<CampsiteDetailPage campsiteId={sampleCampsite.id} />);

		await waitFor(() => expect(screen.getByText("Da Lat Pine Camp")).toBeInTheDocument());

		expect(screen.getByText("Quiet pine forest near the lake")).toBeInTheDocument();
		expect(screen.getAllByText("Lam Dong")[0]).toBeInTheDocument();
		expect(screen.getByText("No loud noises after 10 PM. Clean up trash.")).toBeInTheDocument();
		expect(screen.getByText("08:00 - 22:00")).toBeInTheDocument();
		expect(screen.getByText("2026-06-01 đến 2026-09-30")).toBeInTheDocument();
		expect(screen.getByText("1 đêm")).toBeInTheDocument();
		expect(screen.getByText("7 đêm")).toBeInTheDocument();
		expect(screen.getByText("30 ngày")).toBeInTheDocument();
		expect(screen.getByText("11.940419")).toBeInTheDocument();
		expect(screen.getByText("108.458313")).toBeInTheDocument();

		// Check presence of fallback static sections
		expect(screen.getByText("Đánh giá từ Camper")).toBeInTheDocument();
		expect(screen.getByText("Chưa có đánh giá nào")).toBeInTheDocument();
		expect(screen.getByText("Chuyến đi sắp tới")).toBeInTheDocument();
		expect(screen.getByText("Không có chuyến đi nào sắp diễn ra")).toBeInTheDocument();

		// Check that zones, capacity, slots, and route details are ABSENT
		expect(screen.queryByText("Zone")).not.toBeInTheDocument();
		expect(screen.queryByText("Campsite Zones")).not.toBeInTheDocument();
		expect(screen.queryByText("Zone capacity")).not.toBeInTheDocument();
		expect(screen.queryByText("campsite slots")).not.toBeInTheDocument();
		expect(screen.queryByText("Route detail")).not.toBeInTheDocument();
		expect(screen.queryByText("Checkpoints")).not.toBeInTheDocument();
	});

	it("renders media gallery and toggles active image correctly", async () => {
		mockedGetPublicDetail.mockResolvedValue(sampleCampsite);
		render(<CampsiteDetailPage campsiteId={sampleCampsite.id} />);

		await waitFor(() => expect(screen.getByAltText("Da Lat Pine Camp - 1")).toBeInTheDocument());

		const nextButton = screen.getByLabelText("Next image");
		fireEvent.click(nextButton);

		expect(screen.getByAltText("Da Lat Pine Camp - 2")).toBeInTheDocument();
	});

	it("triggers onBack when back button is clicked", async () => {
		mockedGetPublicDetail.mockResolvedValue(sampleCampsite);
		const handleBack = vi.fn();
		render(<CampsiteDetailPage campsiteId={sampleCampsite.id} onBack={handleBack} />);

		await waitFor(() => expect(screen.getByText("Da Lat Pine Camp")).toBeInTheDocument());

		const backBtn = screen.getByRole("button", { name: /quay lại/i });
		fireEvent.click(backBtn);

		expect(handleBack).toHaveBeenCalledTimes(1);
	});

	it("handles post-guard 401 error mapping (session expired mid-use)", async () => {
		mockedGetPublicDetail.mockRejectedValue(new HttpError("Authentication required", 401, {}));
		render(<CampsiteDetailPage campsiteId="1" />);

		await waitFor(() =>
			expect(
				screen.getByText(
					"Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại."
				)
			).toBeInTheDocument()
		);
	});

	it("handles post-guard 403 error mapping (deactivated or camper permission revoked)", async () => {
		mockedGetPublicDetail.mockRejectedValue(new HttpError("Insufficient permission", 403, {}));
		render(<CampsiteDetailPage campsiteId="1" />);

		await waitFor(() =>
			expect(screen.getByText("Bạn không có quyền xem chi tiết khu cắm trại.")).toBeInTheDocument()
		);
	});

	it("handles 404 error mapping (inactive or non-existent campsite)", async () => {
		mockedGetPublicDetail.mockRejectedValue(new HttpError("Not found", 404, {}));
		render(<CampsiteDetailPage campsiteId="1" />);

		await waitFor(() =>
			expect(
				screen.getByText("Không tìm thấy khu cắm trại hoặc khu cắm trại không hoạt động.")
			).toBeInTheDocument()
		);
	});
});
