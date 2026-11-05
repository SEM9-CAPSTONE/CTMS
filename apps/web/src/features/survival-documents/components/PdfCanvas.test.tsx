import { act, render, screen, waitFor } from "@testing-library/react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { afterEach, expect, it, vi } from "vitest";
import { PdfCanvas } from "./PdfCanvas";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("keeps the visible page until a replacement finishes and discards cancelled renders", async () => {
	const drawImage = vi.fn();
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		drawImage,
	} as unknown as CanvasRenderingContext2D);
	const jobs: Array<{ finish: () => void; cancel: ReturnType<typeof vi.fn> }> = [];
	const page = {
		getViewport: ({ scale }: { scale: number }) => ({ width: 400 * scale, height: 800 * scale }),
		render: vi.fn(() => {
			let finish!: () => void;
			const promise = new Promise<void>((resolve) => {
				finish = resolve;
			});
			const cancel = vi.fn();
			jobs.push({ finish, cancel });
			return { promise, cancel } as unknown as RenderTask;
		}),
	} as unknown as PDFPageProxy;
	const document = { getPage: vi.fn().mockResolvedValue(page) } as unknown as PDFDocumentProxy;
	const view = render(<PdfCanvas document={document} page={1} zoom={1} width={476} />);
	await waitFor(() => expect(jobs).toHaveLength(1));
	await act(async () => jobs[0].finish());
	const visible = screen.getByRole("img", { name: "Trang PDF 1" }) as HTMLCanvasElement;
	const firstWidth = visible.width;

	view.rerender(<PdfCanvas document={document} page={1} zoom={1.25} width={476} />);
	await waitFor(() => expect(jobs).toHaveLength(2));
	expect(visible).toBeVisible();
	expect(visible.width).toBe(firstWidth);
	view.rerender(<PdfCanvas document={document} page={1} zoom={1.5} width={476} />);
	await waitFor(() => expect(jobs).toHaveLength(3));
	expect(jobs[1].cancel).toHaveBeenCalledOnce();
	await act(async () => jobs[1].finish());
	expect(visible.width).toBe(firstWidth);
	expect(drawImage).toHaveBeenCalledTimes(1);
	await act(async () => jobs[2].finish());
	expect(visible.width).toBeGreaterThan(firstWidth);
	expect(drawImage).toHaveBeenCalledTimes(2);
	view.unmount();
});
