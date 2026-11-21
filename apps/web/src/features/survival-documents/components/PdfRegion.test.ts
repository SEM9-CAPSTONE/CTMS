import type { PDFPageProxy } from "pdfjs-dist";
import { describe, expect, it } from "vitest";
import { projectPdfRegion } from "./PdfCanvas";

function page(rotated = false) {
	return {
		view: [10, 20, 610, 820],
		getViewport: () => ({
			width: rotated ? 800 : 600,
			height: rotated ? 600 : 800,
			convertToViewportRectangle: ([a, b, c, d]: number[]) =>
				rotated ? [b - 20, a - 10, d - 20, c - 10] : [a - 10, 820 - b, c - 10, 820 - d],
		}),
	} as unknown as PDFPageProxy;
}
describe("Source region highlighting", () => {
	it("aligns a top-left source rectangle with a cropped PDF viewport", () => {
		const style = projectPdfRegion(page(), {
			l: 10,
			t: 20,
			r: 110,
			b: 70,
			coord_origin: "TOPLEFT",
		});
		expect(style.left).toBeCloseTo(100 / 60);
		expect(style.top).toBeCloseTo(2.5);
		expect(style.width).toBeCloseTo(100 / 6);
		expect(style.height).toBeCloseTo(6.25);
	});
	it("projects the equivalent bottom-left source rectangle to exactly the same highlight", () => {
		expect(
			projectPdfRegion(page(), { l: 10, t: 780, r: 110, b: 730, coord_origin: "BOTTOMLEFT" })
		).toEqual(projectPdfRegion(page(), { l: 10, t: 20, r: 110, b: 70, coord_origin: "TOPLEFT" }));
	});
	it("uses the PDF rotation transform instead of stretching the unrotated box", () => {
		const style = projectPdfRegion(page(true), {
			l: 10,
			t: 20,
			r: 110,
			b: 70,
			coord_origin: "TOPLEFT",
		});
		expect(style.left).toBeCloseTo(91.25);
		expect(style.top).toBeCloseTo(100 / 60);
		expect(style.width).toBeCloseTo(6.25);
		expect(style.height).toBeCloseTo(100 / 6);
	});
});
