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
	},
}));

const createMock = vi.mocked(campsitesService.create);

const createdCampsite: CreatedCampsite = {
	id: "8cc75ab5-8845-43fc-b847-e17cf91a6daa",
	hostId: "host-id",
	name: "Da Lat Pine Camp",
	description: "Quiet trekking campsite",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lam Dong",
	policies: { rules: "No campfires after 21:00" },
	operatingHours: { opensAt: "08:00", closesAt: "18:00" },
	status: "draft",
	media: [
		{
			id: "image-id",
			url: "https://example.com/campsite.jpg",
			type: "photo",
			sortOrder: 1,
		},
	],
	createdAt: "2026-08-19T00:00:00.000Z",
	updatedAt: "2026-08-19T00:00:00.000Z",
};

async function fillValidForm() {
	const user = userEvent.setup();

	await user.type(screen.getByLabelText("Tên campsite *"), "Da Lat Pine Camp");

	await user.type(screen.getByLabelText("Mô tả *"), "Quiet trekking campsite");

	await user.type(screen.getByLabelText("Tỉnh/Thành phố *"), "Lam Dong");

	await user.type(screen.getByLabelText("Vĩ độ *"), "11.940419");
	await user.type(screen.getByLabelText("Kinh độ *"), "108.458313");

	await user.type(screen.getByLabelText("Chính sách *"), "No campfires after 21:00");

	fireEvent.change(screen.getByLabelText("Giờ mở cửa *"), {
		target: { value: "08:00" },
	});

	fireEvent.change(screen.getByLabelText("Giờ đóng cửa *"), {
		target: { value: "18:00" },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Thêm ảnh",
		})
	);

	await user.type(screen.getByLabelText("URL ảnh 1 *"), "https://example.com/campsite.jpg");

	await user.type(screen.getByLabelText("Thứ tự ảnh 1"), "1");

	return user;
}

describe("CreateCampsitePage", () => {
	beforeEach(() => {
		createMock.mockReset();
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
			province: "Lam Dong",
			policies: { rules: "No campfires after 21:00" },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{
					url: "https://example.com/campsite.jpg",
					type: "photo",
					sortOrder: 1,
				},
			],
		});
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

	it("renders the Draft success state", async () => {
		createMock.mockResolvedValue(createdCampsite);

		render(<CreateCampsitePage />);

		const user = await fillValidForm();

		await user.click(
			screen.getByRole("button", {
				name: "Tạo campsite",
			})
		);

		expect(await screen.findByText("Tạo campsite thành công")).toBeInTheDocument();

		expect(screen.getByText("draft")).toBeInTheDocument();

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
