import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite } from "../types";
import { CampsiteFormPage } from "./CampsiteFormPage";

vi.mock("../services/campsites.service", () => ({
	campsitesService: {
		search: vi.fn(),
		getById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		uploadMedia: vi.fn(),
	},
}));

const getByIdMock = vi.mocked(campsitesService.getById);
const createMock = vi.mocked(campsitesService.create);
const updateMock = vi.mocked(campsitesService.update);
const uploadMediaMock = vi.mocked(campsitesService.uploadMedia);

const campsite: CreatedCampsite = {
	id: "8cc75ab5-8845-43fc-b847-e17cf91a6daa",
	hostId: "host-id",
	name: "Da Lat Pine Camp",
	description: "Quiet trekking campsite",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lâm Đồng",
	policies: { rules: "No campfires after 21:00" },
	operatingHours: { opensAt: "08:00", closesAt: "18:00" },
	status: "active",
	media: [
		{
			id: "image-id",
			url: "https://example.com/campsite.jpg",
			type: "photo",
			sortOrder: 0,
		},
	],
	createdAt: "2026-08-19T00:00:00.000Z",
	updatedAt: "2026-08-24T09:00:00.000Z",
};

const createdCampsite: CreatedCampsite = {
	...campsite,
	status: "pending_approval",
	updatedAt: "2026-08-19T00:00:00.000Z",
};

async function fillValidForm() {
	const user = userEvent.setup();

	await user.type(screen.getByLabelText("Tên khu cắm trại *"), "Da Lat Pine Camp");
	await user.type(screen.getByLabelText("Mô tả *"), "Quiet trekking campsite");
	await user.selectOptions(screen.getByLabelText("Tỉnh/Thành phố *"), "Lâm Đồng");
	await user.type(screen.getByLabelText("Địa điểm khu cắm trại *"), "Da Lat Pine Camp");

	fireEvent.keyDown(await screen.findByRole("button", { name: "Bản đồ khu cắm trại" }), {
		key: "Enter",
	});

	await screen.findByTestId("selected-location");
	await user.type(screen.getByLabelText("Chính sách *"), "No campfires after 21:00");

	fireEvent.change(screen.getByLabelText("Giờ mở cửa *"), {
		target: { value: "08:00" },
	});

	fireEvent.change(screen.getByLabelText("Giờ đóng cửa *"), {
		target: { value: "18:00" },
	});

	await user.upload(
		screen.getByLabelText("Chọn ảnh từ thiết bị"),
		new File(["fake image"], "campsite.jpg", { type: "image/jpeg" })
	);

	await screen.findByAltText("Ảnh khu cắm trại 1");

	return user;
}

describe("CampsiteFormPage create mode", () => {
	beforeEach(() => {
		localStorage.clear();
		getByIdMock.mockReset();
		createMock.mockReset();
		updateMock.mockReset();
		uploadMediaMock.mockReset();
		uploadMediaMock.mockResolvedValue({ url: "https://example.com/campsite.jpg" });
		vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	});

	it("renders the image empty state", () => {
		render(<CampsiteFormPage mode="create" />);

		expect(screen.getByRole("heading", { name: "Tạo Khu cắm trại" })).toBeInTheDocument();
		expect(screen.getByTestId("empty-images-state")).toBeInTheDocument();
		expect(screen.getByText("Chưa có ảnh ban đầu")).toBeInTheDocument();
	});

	it("does not call the API when required fields are invalid", async () => {
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="create" />);

		await user.click(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(createMock).not.toHaveBeenCalled();
		expect(await screen.findByText("Tên khu cắm trại là bắt buộc")).toBeInTheDocument();
		expect(screen.getByText("Khu cắm trại phải có ít nhất 1 ảnh")).toBeInTheDocument();
		expect(screen.getByText("Địa điểm khu cắm trại là bắt buộc")).toBeInTheDocument();
	});

	it("calls POST create with the exact API contract", async () => {
		createMock.mockResolvedValue(createdCampsite);

		render(<CampsiteFormPage mode="create" />);

		const user = await fillValidForm();
		await user.click(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock).toHaveBeenCalledWith({
			name: "Da Lat Pine Camp",
			description: "Quiet trekking campsite",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lâm Đồng",
			policies: { rules: "No campfires after 21:00" },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{
					url: "https://example.com/campsite.jpg",
					type: "photo",
					sortOrder: 0,
				},
			],
		});
	});

	it("uses the selected location province when a search suggestion is chosen", async () => {
		render(<CampsiteFormPage mode="create" />);

		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Địa điểm khu cắm trại *"), "Da Lat");
		await user.click(await screen.findByRole("button", { name: "Da Lat Pine Camp, Lâm Đồng" }));

		expect(screen.getByLabelText("Tỉnh/Thành phố *")).toHaveValue("Lâm Đồng");
		expect(screen.getByTestId("selected-location")).toHaveTextContent("11.940419");
	});

	it("renders the loading state and prevents duplicate submission", async () => {
		let resolveRequest!: (value: CreatedCampsite) => void;
		createMock.mockReturnValue(
			new Promise<CreatedCampsite>((resolve) => {
				resolveRequest = resolve;
			})
		);

		render(<CampsiteFormPage mode="create" />);

		const user = await fillValidForm();
		await user.dblClick(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Đang tạo khu cắm trại..." })).toBeDisabled();

		resolveRequest(createdCampsite);
		expect(await screen.findByText("Tạo khu cắm trại thành công")).toBeInTheDocument();
	});

	it("restores the local draft after the form is remounted", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<CampsiteFormPage mode="create" />);

		await user.type(screen.getByLabelText("Tên khu cắm trại *"), "Unsaved Pine Camp");
		await user.selectOptions(screen.getByLabelText("Tỉnh/Thành phố *"), "Đà Nẵng");

		unmount();
		render(<CampsiteFormPage mode="create" />);

		expect(screen.getByLabelText("Tên khu cắm trại *")).toHaveValue("Unsaved Pine Camp");
		expect(screen.getByLabelText("Tỉnh/Thành phố *")).toHaveValue("Đà Nẵng");
	});

	it("renders the pending approval success state", async () => {
		createMock.mockResolvedValue(createdCampsite);

		render(<CampsiteFormPage mode="create" />);

		const user = await fillValidForm();
		await user.click(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(await screen.findByText("Tạo khu cắm trại thành công")).toBeInTheDocument();
		expect(screen.getByText("pending")).toBeInTheDocument();
		expect(screen.getByTestId("created-campsite-id")).toHaveTextContent(createdCampsite.id);
	});

	it("maps a 403 response to a Host permission error", async () => {
		createMock.mockRejectedValue(new HttpError("Forbidden", 403, { message: "Forbidden" }));

		render(<CampsiteFormPage mode="create" />);

		const user = await fillValidForm();
		await user.click(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(
			await screen.findByText(
				"Bạn không có quyền tạo khu cắm trại. Chức năng này chỉ dành cho Host."
			)
		).toBeInTheDocument();
	});

	it("preserves entered data on 409 and allows retry", async () => {
		createMock.mockRejectedValueOnce(
			new HttpError("Conflict", 409, {
				message: "Concurrent campsite conflict",
			})
		);

		render(<CampsiteFormPage mode="create" />);

		const user = await fillValidForm();
		await user.click(screen.getByRole("button", { name: "Tạo khu cắm trại" }));

		expect(await screen.findByText("Concurrent campsite conflict")).toBeInTheDocument();
		expect(screen.getByLabelText("Tên khu cắm trại *")).toHaveValue("Da Lat Pine Camp");

		createMock.mockResolvedValueOnce(createdCampsite);
		await user.click(screen.getByRole("button", { name: "Thử gửi lại" }));

		expect(createMock).toHaveBeenCalledTimes(2);
		expect(await screen.findByText("Tạo khu cắm trại thành công")).toBeInTheDocument();
	});
});

describe("CampsiteFormPage edit mode", () => {
	beforeEach(() => {
		localStorage.clear();
		getByIdMock.mockReset();
		createMock.mockReset();
		updateMock.mockReset();
		uploadMediaMock.mockReset();
		vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	});

	it("renders loading then the editable campsite data", async () => {
		getByIdMock.mockResolvedValue(campsite);

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		expect(screen.getByText("Đang tải thông tin khu cắm trại...")).toBeInTheDocument();
		expect(await screen.findByDisplayValue("Da Lat Pine Camp")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Chỉnh sửa Khu cắm trại" })).toBeInTheDocument();
		expect(screen.getByLabelText("Tỉnh/Thành phố *")).toHaveValue("Lâm Đồng");
		expect(screen.getByAltText("Ảnh khu cắm trại 1")).toBeInTheDocument();
	});

	it("renders an ownership empty/error state when the campsite is not in Host list", async () => {
		getByIdMock.mockRejectedValue(new Error("Campsite not found in Host ownership list"));

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		expect(
			await screen.findByText("Không tìm thấy khu cắm trại thuộc quyền quản lý của bạn.")
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
	});

	it("validates client-side fields before PATCH", async () => {
		getByIdMock.mockResolvedValue(campsite);
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		const nameInput = await screen.findByLabelText("Tên khu cắm trại *");
		await user.clear(nameInput);
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(await screen.findByText("Tên khu cắm trại là bắt buộc")).toBeInTheDocument();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("PATCHes the API contract and renders success", async () => {
		getByIdMock.mockResolvedValue(campsite);
		updateMock.mockResolvedValue({ ...campsite, name: "Updated Pine Camp" });
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		const nameInput = await screen.findByLabelText("Tên khu cắm trại *");
		await user.clear(nameInput);
		await user.type(nameInput, "Updated Pine Camp");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock).toHaveBeenCalledWith(campsite.id, {
			name: "Updated Pine Camp",
			description: "Quiet trekking campsite",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lâm Đồng",
			policies: { rules: "No campfires after 21:00" },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{
					url: "https://example.com/campsite.jpg",
					type: "photo",
					sortOrder: 0,
				},
			],
			expectedUpdatedAt: "2026-08-24T09:00:00.000Z",
			changeReason: "host_edit_campsite",
		});
		expect(await screen.findByText("Cập nhật khu cắm trại thành công")).toBeInTheDocument();
	});

	it("prevents duplicate submissions while the update is pending", async () => {
		let resolveRequest!: (value: CreatedCampsite) => void;
		getByIdMock.mockResolvedValue(campsite);
		updateMock.mockReturnValue(
			new Promise<CreatedCampsite>((resolve) => {
				resolveRequest = resolve;
			})
		);
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		await screen.findByLabelText("Tên khu cắm trại *");
		await user.dblClick(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Đang cập nhật khu cắm trại..." })).toBeDisabled();

		resolveRequest(campsite);
		expect(await screen.findByText("Cập nhật khu cắm trại thành công")).toBeInTheDocument();
	});

	it("maps 403 permission errors without clearing entered data", async () => {
		getByIdMock.mockResolvedValue(campsite);
		updateMock.mockRejectedValue(new HttpError("Forbidden", 403, {}));
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		const nameInput = await screen.findByLabelText("Tên khu cắm trại *");
		await user.clear(nameInput);
		await user.type(nameInput, "Forbidden Edit");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(
			await screen.findByText("Bạn không có quyền cập nhật khu cắm trại này.")
		).toBeInTheDocument();
		expect(screen.getByLabelText("Tên khu cắm trại *")).toHaveValue("Forbidden Edit");
	});

	it("preserves data on 409 and retries the last payload", async () => {
		getByIdMock.mockResolvedValue(campsite);
		updateMock.mockRejectedValueOnce(new HttpError("Conflict", 409, { message: "Stale edit" }));
		updateMock.mockResolvedValueOnce({ ...campsite, name: "Retry Pine Camp" });
		const user = userEvent.setup();

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		const nameInput = await screen.findByLabelText("Tên khu cắm trại *");
		await user.clear(nameInput);
		await user.type(nameInput, "Retry Pine Camp");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(await screen.findByText("Stale edit")).toBeInTheDocument();
		expect(screen.getByLabelText("Tên khu cắm trại *")).toHaveValue("Retry Pine Camp");

		await user.click(screen.getByRole("button", { name: "Thử gửi lại" }));

		expect(updateMock).toHaveBeenCalledTimes(2);
		expect(await screen.findByText("Cập nhật khu cắm trại thành công")).toBeInTheDocument();
	});

	it("shows the image empty state for an editable campsite without media", async () => {
		getByIdMock.mockResolvedValue({ ...campsite, media: [] });

		render(<CampsiteFormPage mode="edit" campsiteId={campsite.id} />);

		expect(await screen.findByText("Chưa có ảnh ban đầu")).toBeInTheDocument();
	});
});
