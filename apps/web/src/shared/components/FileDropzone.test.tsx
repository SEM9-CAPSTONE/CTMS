import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileDropzone, formatFileSize } from "./FileDropzone";

const MIME = ["application/pdf", "image/png"] as const;

function pick(files: File[]) {
	const input = screen.getByTestId("file-dropzone").querySelector("input") as HTMLInputElement;
	fireEvent.change(input, { target: { files } });
}

describe("FileDropzone", () => {
	it("passes valid files and reports wrong type or oversized files", () => {
		const onFilesSelected = vi.fn();
		const onFilesRejected = vi.fn();
		render(
			<FileDropzone
				acceptMimeTypes={MIME}
				maxSizeBytes={10}
				multiple
				onFilesSelected={onFilesSelected}
				onFilesRejected={onFilesRejected}
			/>
		);

		const ok = new File(["%PDF"], "ok.pdf", { type: "application/pdf" });
		const gif = new File(["x"], "a.gif", { type: "image/gif" });
		const big = new File(["0123456789ABC"], "big.png", { type: "image/png" });
		pick([ok, gif, big]);

		expect(onFilesSelected).toHaveBeenCalledWith([ok]);
		expect(onFilesRejected).toHaveBeenCalledWith([
			'"a.gif" không đúng định dạng cho phép.',
			'"big.png" vượt quá 10 B.',
		]);
	});

	it("accepts dropped files and ignores them while disabled", () => {
		const onFilesSelected = vi.fn();
		const { rerender } = render(
			<FileDropzone acceptMimeTypes={MIME} maxSizeBytes={100} onFilesSelected={onFilesSelected} />
		);
		const file = new File(["%PDF"], "drop.pdf", { type: "application/pdf" });
		fireEvent.drop(screen.getByTestId("file-dropzone"), { dataTransfer: { files: [file] } });
		expect(onFilesSelected).toHaveBeenCalledWith([file]);

		onFilesSelected.mockClear();
		rerender(
			<FileDropzone
				acceptMimeTypes={MIME}
				maxSizeBytes={100}
				disabled
				onFilesSelected={onFilesSelected}
			/>
		);
		fireEvent.drop(screen.getByTestId("file-dropzone"), { dataTransfer: { files: [file] } });
		expect(onFilesSelected).not.toHaveBeenCalled();
	});

	it("formats file sizes", () => {
		expect(formatFileSize(512)).toBe("512 B");
		expect(formatFileSize(2048)).toBe("2 KB");
		expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
	});
});
