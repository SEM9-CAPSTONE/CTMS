import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { camperProfileService } from "../services/camper-profile.service";
import type { CamperProfileData } from "../types";
import { CamperProfilePage } from "./CamperProfilePage";

vi.mock("../services/camper-profile.service", () => ({
	camperProfileService: {
		getProfile: vi.fn(),
		updateProfile: vi.fn(),
		updateAvatar: vi.fn(),
	},
}));

vi.mock("../../health-profile/routes", () => ({
	HealthProfileContainer: () => <div>Health profile</div>,
}));

const getProfileMock = vi.mocked(camperProfileService.getProfile);
const updateProfileMock = vi.mocked(camperProfileService.updateProfile);
const updateAvatarMock = vi.mocked(camperProfileService.updateAvatar);

const PROFILE: CamperProfileData = {
	id: "user-1",
	accountStatus: "active",
	fullName: "Nguyen Van B",
	email: "camper@example.com",
	phone: "+84912345678",
	avatarUrl: "https://example.com/avatar.png",
	isProMember: false,
	joinedYear: 2026,
	dateOfBirth: "1995-04-12",
	gender: "male",
	address: "Da Lat, Lam Dong",
	bio: "Weekend trekker",
	campingExperienceYears: 0,
	trekkingExperienceDetails: "",
	languages: [],
	emergencyContacts: [
		{
			id: "contact-1",
			name: "Tran Thi C",
			relationship: "mother",
			phone: "+84911111111",
			email: "mom@example.com",
		},
	],
	completionPercentage: 100,
	emergencyContactAdded: true,
	phoneVerified: true,
};

describe("CamperProfilePage", () => {
	beforeEach(() => {
		getProfileMock.mockReset();
		updateProfileMock.mockReset();
		updateAvatarMock.mockReset();
	});

	it("renders current profile data from the API", async () => {
		getProfileMock.mockResolvedValueOnce(PROFILE);

		render(<CamperProfilePage />);

		expect(await screen.findByDisplayValue("Nguyen Van B")).toBeInTheDocument();
		expect(screen.getByDisplayValue("1995-04-12")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Da Lat, Lam Dong")).toBeInTheDocument();
		expect(screen.queryByDisplayValue("admin")).not.toBeInTheDocument();
		expect(screen.queryByDisplayValue("deleted")).not.toBeInTheDocument();
	});

	it("saves editable profile fields, refreshes the view, and shows success", async () => {
		const user = userEvent.setup();
		getProfileMock.mockResolvedValueOnce(PROFILE);
		updateProfileMock.mockResolvedValueOnce({
			...PROFILE,
			fullName: "Nguyen Van C",
			address: "Sa Pa, Lao Cai",
		});

		render(<CamperProfilePage />);

		const nameInput = await screen.findByDisplayValue("Nguyen Van B");
		await user.clear(nameInput);
		await user.type(nameInput, "Nguyen Van C");
		await user.clear(screen.getByDisplayValue("Da Lat, Lam Dong"));
		await user.type(screen.getByLabelText(/Địa chỉ/i), "Sa Pa, Lao Cai");
		await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

		await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
		expect(updateProfileMock.mock.calls[0][0]).toMatchObject({
			fullName: "Nguyen Van C",
			address: "Sa Pa, Lao Cai",
			emergencyContacts: PROFILE.emergencyContacts,
		});
		expect(await screen.findByText("Hồ sơ đã được lưu thành công!")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Nguyen Van C")).toBeInTheDocument();
	});

	it("shows mapped API errors and preserves entered data", async () => {
		const user = userEvent.setup();
		getProfileMock.mockResolvedValueOnce(PROFILE);
		updateProfileMock.mockRejectedValueOnce(
			new HttpError("Unprocessable Entity", 422, {
				statusCode: 422,
				message: [],
				error: "Unprocessable Entity",
			})
		);

		render(<CamperProfilePage />);

		const nameInput = await screen.findByDisplayValue("Nguyen Van B");
		await user.clear(nameInput);
		await user.type(nameInput, "Nguyen Van D");
		await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

		expect(
			await screen.findByText(
				"Thông tin hồ sơ chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu."
			)
		).toBeInTheDocument();
		expect(screen.getByDisplayValue("Nguyen Van D")).toBeInTheDocument();
	});

	it("validates future birth dates before submitting", async () => {
		const user = userEvent.setup();
		getProfileMock.mockResolvedValueOnce(PROFILE);

		render(<CamperProfilePage />);

		const dateInput = await screen.findByDisplayValue("1995-04-12");
		await user.clear(dateInput);
		await user.type(dateInput, "2999-01-01");
		await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

		expect(await screen.findByText("Ngày sinh không được ở tương lai")).toBeInTheDocument();
		expect(updateProfileMock).not.toHaveBeenCalled();
	});

	it("prevents editing when the account status is not active", async () => {
		getProfileMock.mockResolvedValueOnce({ ...PROFILE, accountStatus: "suspended" });

		render(<CamperProfilePage />);

		expect(await screen.findByDisplayValue("Nguyen Van B")).toBeDisabled();
		expect(screen.queryByRole("button", { name: /Lưu thay đổi/i })).not.toBeInTheDocument();
	});

	it("prevents repeated submissions while saving", async () => {
		const user = userEvent.setup();
		let resolveSave: (value: CamperProfileData) => void = () => {};
		getProfileMock.mockResolvedValueOnce(PROFILE);
		updateProfileMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveSave = resolve;
				})
		);

		render(<CamperProfilePage />);

		const nameInput = await screen.findByDisplayValue("Nguyen Van B");
		await user.clear(nameInput);
		await user.type(nameInput, "Nguyen Van E");
		const saveButton = screen.getByRole("button", { name: /Lưu thay đổi/i });
		await user.click(saveButton);
		await user.click(saveButton);
		await user.click(saveButton);

		expect(updateProfileMock).toHaveBeenCalledTimes(1);
		resolveSave({ ...PROFILE, fullName: "Nguyen Van E" });
	});

	it("shows an error state when the profile cannot be loaded", async () => {
		getProfileMock.mockRejectedValueOnce(new HttpError("Unauthorized", 401, {}));

		render(<CamperProfilePage />);

		expect(
			await screen.findByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
		).toBeInTheDocument();
	});

	it("does not render removed settings tabs (Thiết bị cá nhân, Thông báo, Thông tin liên hệ)", async () => {
		getProfileMock.mockResolvedValueOnce(PROFILE);

		render(<CamperProfilePage />);

		await screen.findByDisplayValue("Nguyen Van B");
		expect(screen.queryByText("Thiết bị cá nhân")).not.toBeInTheDocument();
		expect(screen.queryByText("Thông báo")).not.toBeInTheDocument();
		expect(screen.queryByText("Thông tin liên hệ")).not.toBeInTheDocument();
		expect(screen.getByText("Tài khoản ngân hàng")).toBeInTheDocument();
		expect(screen.getByText("Hồ sơ cá nhân")).toBeInTheDocument();
	});

	it("validates mandatory phone number on personal profile form", async () => {
		const user = userEvent.setup();
		getProfileMock.mockResolvedValueOnce(PROFILE);

		render(<CamperProfilePage />);

		const phoneInput = await screen.findByDisplayValue("+84912345678");
		await user.clear(phoneInput);
		await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

		expect(await screen.findByText("Vui lòng nhập số điện thoại")).toBeInTheDocument();
		expect(updateProfileMock).not.toHaveBeenCalled();
	});

	it("renders ProfileCompletionCard with accurate 50% completion, emergency contacts, and phone", async () => {
		const partialProfile: CamperProfileData = {
			...PROFILE,
			fullName: "Nguyen Van B",
			phone: "0900000003",
			dateOfBirth: "",
			gender: "male" as const,
			address: "",
			emergencyContacts: [
				{
					id: "contact-1",
					name: "Tran Thi C",
					relationship: "mother",
					phone: "+84911111111",
					email: "mom@example.com",
				},
			],
			completionPercentage: 50,
			emergencyContactAdded: true,
			phoneVerified: true,
		};
		// Notice: fullName (1), phone (1), emergencyContacts (1) = 3 / 6 = 50%
		// dateOfBirth (""), gender (null or unset), address ("")
		getProfileMock.mockResolvedValueOnce({
			...partialProfile,
			gender: null as unknown as "male",
		});

		const user = userEvent.setup();
		render(<CamperProfilePage />);

		expect(await screen.findByText("Hoàn thiện hồ sơ")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
		expect(
			screen.getByText("Đảm bảo an toàn tuyệt đối và quy trình ứng cứu khẩn cấp.")
		).toBeInTheDocument();

		// Initially collapsed: shows progress and toggle button
		const toggleButton = screen.getByRole("button", { name: /Chi tiết/i });
		expect(toggleButton).toBeInTheDocument();
		expect(screen.queryByText("Đã lưu 1 người thân")).not.toBeInTheDocument();

		// Click toggle to view breakdown
		await user.click(toggleButton);

		// Now itemized details are visible
		expect(screen.getByText("Đã lưu 1 người thân")).toBeInTheDocument();
		expect(screen.getByText("0900000003")).toBeInTheDocument();
		expect(screen.getByText(/Cần bổ sung/i)).toBeInTheDocument();
		expect(screen.getByText(/Đã hoàn thành/i)).toBeInTheDocument();
	});

	it("navigates to bookings when clicking Đơn đặt chỗ in the sidebar", async () => {
		const user = userEvent.setup();
		const onNavigateToBookings = vi.fn();
		getProfileMock.mockResolvedValueOnce(PROFILE);

		render(<CamperProfilePage onNavigateToBookings={onNavigateToBookings} />);

		await screen.findByDisplayValue("Nguyen Van B");
		const bookingsButton = screen.getByRole("button", { name: /Đơn đặt chỗ/i });
		await user.click(bookingsButton);

		expect(onNavigateToBookings).toHaveBeenCalledTimes(1);
	});

	it("preserves avatarUrl when saving profile form", async () => {
		const user = userEvent.setup();
		getProfileMock.mockResolvedValueOnce({
			...PROFILE,
			avatarUrl: "https://cloudinary.com/test-avatar.jpg",
		});
		updateProfileMock.mockResolvedValueOnce({
			...PROFILE,
			avatarUrl: "https://cloudinary.com/test-avatar.jpg",
			fullName: "Nguyen Van B Updated",
		});

		render(<CamperProfilePage />);

		const nameInput = await screen.findByDisplayValue("Nguyen Van B");
		await user.clear(nameInput);
		await user.type(nameInput, "Nguyen Van B Updated");
		await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

		await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
		expect(updateProfileMock.mock.calls[0][0]).toMatchObject({
			fullName: "Nguyen Van B Updated",
			avatarUrl: "https://cloudinary.com/test-avatar.jpg",
		});
	});
});
