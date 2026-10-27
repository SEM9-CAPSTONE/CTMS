import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tripsService } from "../services/trips.service";
import { TripImageGallery } from "./TripImageGallery";
vi.mock("../services/trips.service", () => ({
	tripsService: { getImages: vi.fn(), addImage: vi.fn(), removeImage: vi.fn() },
}));
const images = Array.from({ length: 5 }, (_, i) => ({
	id: String(i),
	url: `https://example.test/${i}.png`,
	sortOrder: i,
}));
function show(canManage = true, status = "draft") {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const changed = vi.fn();
	render(
		<QueryClientProvider client={client}>
			<TripImageGallery
				tripId="trip"
				status={status}
				canManage={canManage}
				onImagesChange={changed}
			/>
		</QueryClientProvider>
	);
	return changed;
}
beforeEach(() => {
	vi.resetAllMocks();
	document.documentElement.lang = "vi";
	vi.mocked(tripsService.getImages).mockResolvedValue([]);
});
describe("TripImageGallery", () => {
	it("uploads and displays the authoritative thumbnail", async () => {
		vi.mocked(tripsService.addImage).mockResolvedValue([images[0]]);
		const changed = show();
		const input = screen.getByLabelText("Thêm ảnh");
		await waitFor(() => expect(input).toBeEnabled());
		const file = new File(["image"], "image.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });
		expect(await screen.findByText("Ảnh đại diện")).toBeVisible();
		expect(tripsService.addImage).toHaveBeenCalledWith("trip", file);
		expect(changed).toHaveBeenLastCalledWith([images[0].url]);
	});
	it("disables uploads at five images", async () => {
		vi.mocked(tripsService.getImages).mockResolvedValue(images);
		show();
		expect(await screen.findAllByRole("img")).toHaveLength(5);
		expect(screen.getByLabelText("Thêm ảnh")).toBeDisabled();
	});
	it("rejects invalid files without making a request", async () => {
		show();
		const input = screen.getByLabelText("Thêm ảnh");
		await waitFor(() => expect(input).toBeEnabled());
		fireEvent.change(input, {
			target: { files: [new File(["x"], "x.svg", { type: "image/svg+xml" })] },
		});
		expect(await screen.findByRole("alert")).toHaveTextContent("Chọn ảnh JPG");
		expect(tripsService.addImage).not.toHaveBeenCalled();
	});
	it("exposes upload failures and retains existing images", async () => {
		vi.mocked(tripsService.getImages).mockResolvedValue([images[0]]);
		vi.mocked(tripsService.addImage).mockRejectedValue(new Error("storage unavailable"));
		show();
		const input = screen.getByLabelText("Thêm ảnh");
		await waitFor(() => expect(input).toBeEnabled());
		fireEvent.change(input, {
			target: { files: [new File(["x"], "x.png", { type: "image/png" })] },
		});
		expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật ảnh");
		expect(screen.getAllByRole("img")).toHaveLength(1);
	});
	it("removes the first image and exposes queued storage deletion", async () => {
		vi.mocked(tripsService.getImages).mockResolvedValue([images[0], images[1]]);
		vi.mocked(tripsService.removeImage).mockResolvedValue({
			images: [images[1]],
			storageCleanup: "queued",
		});
		const changed = show();
		fireEvent.click(await screen.findByLabelText("Xóa ảnh 1"));
		expect(await screen.findByText(/File đang được xóa/)).toBeVisible();
		expect(screen.getAllByRole("img")).toHaveLength(1);
		expect(changed).toHaveBeenLastCalledWith([images[1].url]);
	});
	it.each(["ongoing", "completed", "cancelled"])("hides mutations for %s Trips", async (status) => {
		vi.mocked(tripsService.getImages).mockResolvedValue([images[0]]);
		show(true, status);
		await screen.findByRole("img");
		expect(screen.queryByLabelText("Thêm ảnh")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Xóa ảnh 1")).not.toBeInTheDocument();
	});
	it("hides mutations for viewers", async () => {
		show(false);
		await waitFor(() => expect(screen.queryByText("Đang tải ảnh…")).not.toBeInTheDocument());
		expect(screen.queryByLabelText("Thêm ảnh")).not.toBeInTheDocument();
	});
});
