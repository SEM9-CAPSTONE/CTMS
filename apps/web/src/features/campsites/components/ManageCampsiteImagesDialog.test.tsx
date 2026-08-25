import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite } from "../types";
import { ManageCampsiteImagesDialog } from "./ManageCampsiteImagesDialog";

vi.mock("../services/campsites.service", () => ({
	campsitesService: {
		search: vi.fn(),
		getById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		updateMedia: vi.fn(),
		uploadMedia: vi.fn(),
	},
}));

const updateMediaMock = vi.mocked(campsitesService.updateMedia);
const uploadMediaMock = vi.mocked(campsitesService.uploadMedia);

const mockCampsite: CreatedCampsite = {
	id: "campsite-123",
	hostId: "host-456",
	name: "Da Lat Pine Forest Camp",
	description: "Beautiful campsite in the pine forest of Da Lat.",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lâm Đồng",
	policies: { rules: "No campfires after 21:00" },
	operatingHours: { opensAt: "08:00", closesAt: "18:00" },
	status: "active",
	media: [
		{
			id: "img-1",
			url: "https://example.com/photo1.jpg",
			type: "photo",
			sortOrder: 0,
		},
		{
			id: "img-2",
			url: "https://example.com/photo2.jpg",
			type: "photo",
			sortOrder: 1,
		},
	],
	createdAt: "2026-08-19T00:00:00.000Z",
	updatedAt: "2026-08-24T09:00:00.000Z",
};

describe("ManageCampsiteImagesDialog", () => {
	beforeEach(() => {
		updateMediaMock.mockReset();
		uploadMediaMock.mockReset();
	});

	it("renders correctly with campsite images", () => {
		render(
			<ManageCampsiteImagesDialog
				open={true}
				campsite={mockCampsite}
				onClose={vi.fn()}
				onUpdateSuccess={vi.fn()}
			/>
		);

		expect(screen.getByText("Quản lý ảnh khu cắm trại")).toBeInTheDocument();
		expect(screen.getByText("Da Lat Pine Forest Camp")).toBeInTheDocument();
		expect(screen.getByAltText("Ảnh khu cắm trại 1")).toBeInTheDocument();
		expect(screen.getByAltText("Ảnh khu cắm trại 2")).toBeInTheDocument();
	});

	it("supports uploading and appending new image", async () => {
		const user = userEvent.setup();
		uploadMediaMock.mockResolvedValue({ url: "https://example.com/photo3.jpg" });

		render(
			<ManageCampsiteImagesDialog
				open={true}
				campsite={mockCampsite}
				onClose={vi.fn()}
				onUpdateSuccess={vi.fn()}
			/>
		);

		await user.upload(
			screen.getByLabelText("Chọn ảnh từ thiết bị"),
			new File(["fake_data"], "photo3.jpg", { type: "image/jpeg" })
		);

		expect(uploadMediaMock).toHaveBeenCalledTimes(1);
		await screen.findByAltText("Ảnh khu cắm trại 3");
		expect(screen.getByAltText("Ảnh khu cắm trại 3")).toHaveAttribute(
			"src",
			"https://example.com/photo3.jpg"
		);
	});

	it("shows client validation error when deleting last image", async () => {
		const user = userEvent.setup();
		render(
			<ManageCampsiteImagesDialog
				open={true}
				campsite={{
					...mockCampsite,
					media: [mockCampsite.media[0]],
				}}
				onClose={vi.fn()}
				onUpdateSuccess={vi.fn()}
			/>
		);

		// Click delete for the only image
		await user.click(screen.getByLabelText("Xóa ảnh 1"));
		expect(screen.queryByAltText("Ảnh khu cắm trại 1")).not.toBeInTheDocument();

		// Try to submit
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(await screen.findByText("Khu cắm trại phải có ít nhất 1 ảnh")).toBeInTheDocument();
		expect(updateMediaMock).not.toHaveBeenCalled();
	});

	it("supports reordering images with Move buttons", async () => {
		const user = userEvent.setup();
		render(
			<ManageCampsiteImagesDialog
				open={true}
				campsite={mockCampsite}
				onClose={vi.fn()}
				onUpdateSuccess={vi.fn()}
			/>
		);

		// Initial order: photo1 is first, photo2 is second
		const imagesBefore = screen.getAllByRole("img");
		expect(imagesBefore[0]).toHaveAttribute("src", "https://example.com/photo1.jpg");
		expect(imagesBefore[1]).toHaveAttribute("src", "https://example.com/photo2.jpg");

		// Move photo1 (first image) right
		await user.click(screen.getByLabelText("Di chuyển ảnh 1 sang phải"));

		// Order should be swapped
		const imagesAfter = screen.getAllByRole("img");
		expect(imagesAfter[0]).toHaveAttribute("src", "https://example.com/photo2.jpg");
		expect(imagesAfter[1]).toHaveAttribute("src", "https://example.com/photo1.jpg");
	});

	it("handles API error responses and allows retry", async () => {
		const user = userEvent.setup();
		const updateSuccessSpy = vi.fn();

		const conflictError = new HttpError("Conflict", 409, {
			message: "Dữ liệu đã thay đổi bởi phiên khác",
		});

		updateMediaMock.mockRejectedValueOnce(conflictError);

		render(
			<ManageCampsiteImagesDialog
				open={true}
				campsite={mockCampsite}
				onClose={vi.fn()}
				onUpdateSuccess={updateSuccessSpy}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

		expect(updateMediaMock).toHaveBeenCalledTimes(1);
		expect(await screen.findByText("Không thể cập nhật ảnh")).toBeInTheDocument();
		expect(screen.getByText("Dữ liệu đã thay đổi bởi phiên khác")).toBeInTheDocument();
		expect(updateSuccessSpy).not.toHaveBeenCalled();

		// Try to retry
		updateMediaMock.mockResolvedValueOnce([
			{ id: "img-1", url: "https://example.com/photo1.jpg", type: "photo", sortOrder: 0 },
			{ id: "img-2", url: "https://example.com/photo2.jpg", type: "photo", sortOrder: 1 },
		]);

		await user.click(screen.getByRole("button", { name: "Thử gửi lại" }));
		expect(updateMediaMock).toHaveBeenCalledTimes(2);

		await waitFor(() => {
			expect(updateSuccessSpy).toHaveBeenCalledTimes(1);
		});
	});
});
