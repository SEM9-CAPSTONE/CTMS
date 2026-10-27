import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PendingTripImageEditor } from "./PendingTripImageEditor";
const api = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock("../hooks/useTripImages", () => ({
	useTripImages: () => ({
		query: { data: [], isPending: false, isError: false },
		add: { mutateAsync: api.add },
		remove: { mutateAsync: api.remove },
	}),
}));
beforeEach(() => vi.clearAllMocks());
it("keeps removals and new files in the private update buffer", () => {
	const image = { id: "one", url: "https://example.test/one.png", sortOrder: 0 };
	const change = vi.fn();
	render(
		<PendingTripImageEditor
			tripId="trip"
			value={{ retained: [image], files: [] }}
			onChange={change}
		/>
	);
	fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh 1" }));
	expect(change).toHaveBeenCalledWith({ retained: [], files: [] });
	const file = new File(["png"], "two.png", { type: "image/png" });
	fireEvent.change(screen.getByLabelText("Thêm ảnh"), { target: { files: [file] } });
	expect(change).toHaveBeenLastCalledWith({ retained: [image], files: [file] });
	expect(api.add).not.toHaveBeenCalled();
	expect(api.remove).not.toHaveBeenCalled();
});
it("rejects a selection exceeding five total images without changing the buffer", () => {
	const retained = Array.from({ length: 4 }, (_, index) => ({
		id: String(index),
		url: `https://example.test/${index}.png`,
		sortOrder: index,
	}));
	const change = vi.fn();
	render(
		<PendingTripImageEditor tripId="trip" value={{ retained, files: [] }} onChange={change} />
	);
	fireEvent.change(screen.getByLabelText("Thêm ảnh"), {
		target: {
			files: [
				new File(["png"], "a.png", { type: "image/png" }),
				new File(["png"], "b.png", { type: "image/png" }),
			],
		},
	});
	expect(screen.getByRole("alert")).toHaveTextContent("tối đa 5 ảnh");
	expect(change).not.toHaveBeenCalled();
});
