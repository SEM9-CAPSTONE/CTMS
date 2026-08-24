import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite } from "../types";
import { CreateCampsitePage } from "./CreateCampsitePage";

vi.mock("../services/campsites.service", () => ({
	campsitesService: {
		search: vi.fn(),
		create: vi.fn(),
		uploadMedia: vi.fn(),
	},
}));

const createMock = vi.mocked(campsitesService.create);
const uploadMediaMock = vi.mocked(campsitesService.uploadMedia);

const createdCampsite: CreatedCampsite = {
	id: "8cc75ab5-8845-43fc-b847-e17cf91a6daa",
	hostId: "host-id",
	name: "Da Lat Pine Camp",
	description: "Quiet trekking campsite",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lâm Đồng",
	policies: { rules: "No campfires after 21:00" },
	operatingHours: { opensAt: "08:00", closesAt: "18:00" },
	status: "pending_approval",
	media: [
		{
			id: "image-id",
			url: "https://example.com/campsite.jpg",
			type: "photo",
			sortOrder: 0,
		},
	],
	createdAt: "2026-08-19T00:00:00.000Z",
	updatedAt: "2026-08-19T00:00:00.000Z",
};

async function fillValidForm() {
	const user = userEvent.setup();

	await user.type(screen.getByLabelText("Tên campsite *"), "Da Lat Pine Camp");

	await user.type(screen.getByLabelText("Mô tả *"), "Quiet trekking campsite");

	await user.selectOptions(screen.getByLabelText("Tỉnh/Thành phố *"), "Lâm Đồng");

	await user.type(screen.getByLabelText("Địa điểm campsite *"), "Da Lat Pine Camp");

	fireEvent.keyDown(await screen.findByRole("button", { name: "Bản đồ campsite" }), {
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

	await screen.findByAltText("Ảnh campsite 1");

	return user;
}

describe("CreateCampsitePage", () => {
	beforeEach(() => {
		localStorage.clear();
		createMock.mockReset();
		uploadMediaMock.mockReset();
		uploadMediaMock.mockResolvedValue({ url: "https://example.com/campsite.jpg" });
		vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	});

	it("renders the image empty state", () => {
		render(<CreateCampsitePage />);

		expect(screen.getByTestId("empty-images-state")).toBeInTheDocument();

		expect(screen.getByText("Chưa có ảnh ban đầu")).toBeInTheDocument();
	});

	it("does not call the API when required fields are invalid", async () => {
		const user = userEvent.setup();

		render(<CreateCampsitePage />);

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

		expect(createMock).not.toHaveBeenCalled();

		expect(await screen.findByText("Tên campsite là bắt buộc")).toBeInTheDocument();

		expect(screen.getByText("Campsite phải có ít nhất 1 ảnh")).toBeInTheDocument();

		expect(screen.getByText("Địa điểm campsite là bắt buộc")).toBeInTheDocument();
	});

	it("calls POST create with the exact API contract", async () => {
		createMock.mockResolvedValue(createdCampsite);

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

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
		render(<CreateCampsitePage />);

		const user = userEvent.setup();

		await user.type(screen.getByLabelText("Địa điểm campsite *"), "Da Lat");

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

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		const button = screen.getByRole("button", {
			name: "Tạo campsite",
		});

		await user.dblClick(button);

		expect(createMock).toHaveBeenCalledTimes(1);

		expect(
			screen.getByRole("button", {
				name: "Đang tạo campsite...",
			})
		).toBeDisabled();

		resolveRequest(createdCampsite);

		expect(await screen.findByText("Tạo campsite thành công")).toBeInTheDocument();
	});

	it("restores the local draft after the form is remounted", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<CreateCampsitePage />);

		await user.type(screen.getByLabelText("Tên campsite *"), "Unsaved Pine Camp");
		await user.selectOptions(screen.getByLabelText("Tỉnh/Thành phố *"), "Đà Nẵng");

		unmount();
		render(<CreateCampsitePage />);

		expect(screen.getByLabelText("Tên campsite *")).toHaveValue("Unsaved Pine Camp");
		expect(screen.getByLabelText("Tỉnh/Thành phố *")).toHaveValue("Đà Nẵng");
	});

	it("renders the pending approval success state", async () => {
		createMock.mockResolvedValue(createdCampsite);

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

		expect(await screen.findByText("Tạo campsite thành công")).toBeInTheDocument();

		expect(screen.getByText("pending")).toBeInTheDocument();

		expect(screen.getByTestId("created-campsite-id")).toHaveTextContent(createdCampsite.id);
	});

	it("maps a 403 response to a Host permission error", async () => {
		createMock.mockRejectedValue(new HttpError("Forbidden", 403, { message: "Forbidden" }));

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

		expect(
			await screen.findByText("Bạn không có quyền tạo campsite. Chức năng này chỉ dành cho Host.")
		).toBeInTheDocument();
	});

	it("preserves entered data on 409 and allows retry", async () => {
		createMock.mockRejectedValueOnce(
			new HttpError("Conflict", 409, {
				message: "Concurrent campsite conflict",
			})
		);

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

		expect(await screen.findByText("Concurrent campsite conflict")).toBeInTheDocument();

		expect(screen.getByLabelText("Tên campsite *")).toHaveValue("Da Lat Pine Camp");

		createMock.mockResolvedValueOnce(createdCampsite);

		await user.click(
			screen.getByRole("button", {
				name: "Thử gửi lại",
			})
		);

		expect(createMock).toHaveBeenCalledTimes(2);

		expect(await screen.findByText("Tạo campsite thành công")).toBeInTheDocument();
	});
});
