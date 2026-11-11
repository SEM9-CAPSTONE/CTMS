import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripImagePicker } from "./TripImagePicker";
function Picker() {
	const [files, setFiles] = useState<File[]>([]);
	return <TripImagePicker files={files} onChange={setFiles} />;
}
const file = (name: string, type = "image/png") => new File([name], name, { type });
beforeEach(() => {
	document.documentElement.lang = "vi";
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: vi.fn((f: File) => `blob:${f.name}`),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
describe("TripImagePicker", () => {
	it("allows five images, labels the first as cover and promotes the next after removal", () => {
		render(<Picker />);
		const files = Array.from({ length: 5 }, (_, i) => file(`${i}.png`));
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), { target: { files } });
		expect(screen.getAllByRole("img")).toHaveLength(5);
		expect(screen.getByLabelText("Thêm ảnh")).toBeDisabled();
		fireEvent.click(screen.getByLabelText("Xóa ảnh 1"));
		expect(screen.getAllByRole("img")[0]).toHaveAttribute("alt", "1.png");
		expect(screen.getByLabelText("Thêm ảnh")).toBeEnabled();
	});
	it("rejects a selection over the limit without retaining any files", () => {
		render(<Picker />);
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), {
			target: { files: Array.from({ length: 6 }, (_, i) => file(`${i}.png`)) },
		});
		expect(screen.getByRole("alert")).toHaveTextContent("tối đa 5 ảnh");
		expect(screen.queryAllByRole("img")).toHaveLength(0);
	});
	it.each([
		file("bad.svg", "image/svg+xml"),
		new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }),
	])("rejects invalid or oversized files", (invalid) => {
		render(<Picker />);
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), { target: { files: [invalid] } });
		expect(screen.getByRole("alert")).toHaveTextContent("Chọn ảnh JPG");
		expect(screen.queryAllByRole("img")).toHaveLength(0);
	});
	it("releases previews when the picker unmounts", () => {
		const { unmount } = render(<Picker />);
		fireEvent.change(screen.getByLabelText("Thêm ảnh"), { target: { files: [file("first.png")] } });
		unmount();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first.png");
	});
	it("accepts dropped images and replaces the empty dropzone with a gallery", () => {
		render(<Picker />);
		expect(screen.getByText("Kéo thả hình ảnh vào đây")).toBeVisible();
		fireEvent.drop(screen.getByTestId("trip-image-dropzone"), {
			dataTransfer: { files: [file("mountain.png"), file("trail.png")] },
		});
		expect(screen.queryByText("Kéo thả hình ảnh vào đây")).not.toBeInTheDocument();
		expect(screen.getAllByRole("img")).toHaveLength(2);
		expect(screen.getByText("Ảnh bìa")).toBeVisible();
		expect(screen.getByRole("button", { name: "Thêm ảnh" })).toBeVisible();
		expect(screen.getByText("2/5")).toBeVisible();
	});
	it("keeps the create form Vietnamese when the document language is English", () => {
		document.documentElement.lang = "en";
		render(<Picker />);
		expect(screen.getByText("Hình ảnh chuyến đi")).toBeVisible();
		expect(screen.getByRole("button", { name: "Chọn ảnh" })).toBeVisible();
	});
	it("rejects invalid dropped files and ignores drops while disabled", () => {
		const onChange = vi.fn();
		const { rerender } = render(<TripImagePicker files={[]} onChange={onChange} />);
		fireEvent.drop(screen.getByTestId("trip-image-dropzone"), {
			dataTransfer: { files: [file("bad.svg", "image/svg+xml")] },
		});
		expect(screen.getByRole("alert")).toHaveTextContent("Chọn ảnh JPG");
		expect(onChange).not.toHaveBeenCalled();
		rerender(<TripImagePicker files={[]} onChange={onChange} disabled />);
		fireEvent.drop(screen.getByTestId("trip-image-dropzone"), {
			dataTransfer: { files: [file("valid.png")] },
		});
		expect(onChange).not.toHaveBeenCalled();
	});
});
