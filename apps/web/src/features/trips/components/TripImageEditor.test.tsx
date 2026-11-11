import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripImageEditor } from "./TripImageEditor";
const state = vi.hoisted(() => ({
	images: [{ id: "first", url: "https://example.test/first.png" }],
	add: vi.fn(),
	remove: vi.fn(),
	refetch: vi.fn(),
}));
vi.mock("../hooks/useTripImages", () => ({
	useTripImages: () => ({
		query: { data: state.images, isPending: false, isError: false, refetch: state.refetch },
		add: { mutateAsync: state.add },
		remove: { mutateAsync: state.remove },
	}),
}));
beforeEach(() => {
	vi.clearAllMocks();
	state.images = [{ id: "first", url: "https://example.test/first.png" }];
	state.add.mockResolvedValue([]);
	state.remove.mockResolvedValue({ images: [] });
});
describe("editing saved Trip images", () => {
	it("shows the saved image and cover badge", () => {
		render(<TripImageEditor tripId="trip" onBusyChange={vi.fn()} />);
		expect(screen.getByRole("img", { name: "Ảnh chuyến đi 1" })).toHaveAttribute(
			"src",
			"https://example.test/first.png"
		);
		expect(screen.getByText("Ảnh bìa")).toBeVisible();
		expect(screen.getByText("1/5")).toBeVisible();
	});
	it("removes the existing image by id", async () => {
		const busy = vi.fn();
		render(<TripImageEditor tripId="trip" onBusyChange={busy} />);
		fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh 1" }));
		await waitFor(() => expect(state.remove).toHaveBeenCalledWith("first"));
		await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
	});
	it("rejects files exceeding the remaining slots", () => {
		state.images = Array.from({ length: 4 }, (_, i) => ({
			id: String(i),
			url: `https://example.test/${i}.png`,
		}));
		render(<TripImageEditor tripId="trip" onBusyChange={vi.fn()} />);
		const files = [
			new File(["png"], "one.png", { type: "image/png" }),
			new File(["png"], "two.png", { type: "image/png" }),
		];
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), { target: { files } });
		expect(screen.getByRole("alert")).toHaveTextContent("tối đa 5 ảnh");
		expect(state.add).not.toHaveBeenCalled();
	});
	it("exposes upload failure and preserves saved images", async () => {
		state.add.mockRejectedValue(new Error("Failed"));
		render(<TripImageEditor tripId="trip" onBusyChange={vi.fn()} />);
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), {
			target: { files: [new File(["png"], "one.png", { type: "image/png" })] },
		});
		expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật ảnh");
		expect(screen.getByRole("img", { name: "Ảnh chuyến đi 1" })).toBeVisible();
	});
});
