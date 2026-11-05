import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { type RefObject, useEffect, useRef, useState } from "react";

export function PdfCanvas({
	document,
	page,
	zoom,
	width,
	aspectRatio = Math.SQRT1_2,
	scrollRoot,
}: {
	document: PDFDocumentProxy;
	page: number;
	zoom: number;
	width: number;
	aspectRatio?: number;
	scrollRoot?: RefObject<HTMLDivElement>;
}) {
	const container = useRef<HTMLDivElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const [visible, setVisible] = useState(!scrollRoot);
	const [ratio, setRatio] = useState(aspectRatio);
	const [displayed, setDisplayed] = useState<{
		document: PDFDocumentProxy;
		key: string;
		page: number;
	}>();
	const [failure, setFailure] = useState<{ document: PDFDocumentProxy; key: string }>();
	const renderKey = `${page}/${zoom}/${width}`;

	useEffect(() => {
		const element = container.current;
		if (!element) return;
		if (!scrollRoot) return;
		if (typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
			{ root: scrollRoot.current, rootMargin: "600px 0px" }
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [scrollRoot]);

	useEffect(() => {
		const element = canvas.current;
		if (!element || !width) return;
		if (!visible) {
			element.width = 0;
			element.height = 0;
			setDisplayed(undefined);
			return;
		}
		let active = true;
		let task: RenderTask | undefined;
		async function render(target: HTMLCanvasElement) {
			const pdfPage = await document.getPage(page);
			if (!active) return;
			const base = pdfPage.getViewport({ scale: 1 });
			setRatio(base.width / base.height);
			const viewport = pdfPage.getViewport({ scale: (width / base.width) * zoom });
			const pixels = Math.min(
				window.devicePixelRatio || 1,
				2,
				8192 / Math.max(viewport.width, viewport.height),
				Math.sqrt(8_000_000 / (viewport.width * viewport.height))
			);
			// Render off-screen so resizing and cancellation leave the visible page intact.
			const buffer = window.document.createElement("canvas");
			buffer.width = Math.max(1, Math.floor(viewport.width * pixels));
			buffer.height = Math.max(1, Math.floor(viewport.height * pixels));
			task = pdfPage.render({ canvas: buffer, viewport, transform: [pixels, 0, 0, pixels, 0, 0] });
			await task.promise;
			if (!active) return;
			const context = target.getContext("2d");
			if (!context) throw new Error("Canvas context unavailable");
			target.width = buffer.width;
			target.height = buffer.height;
			context.drawImage(buffer, 0, 0);
			setDisplayed({ document, key: renderKey, page });
			setFailure(undefined);
		}
		void render(element).catch(() => {
			if (active) setFailure({ document, key: renderKey });
		});
		return () => {
			active = false;
			task?.cancel();
		};
	}, [document, page, zoom, width, renderKey, visible]);

	const hasPage = displayed?.document === document;
	const rendered = hasPage && displayed.key === renderKey;
	const failed = failure?.document === document && failure.key === renderKey;
	return (
		<div
			ref={container}
			aria-busy={visible && !rendered && !failed}
			className="relative mx-auto shrink-0 bg-white shadow-sm"
			style={{ width: width * zoom, aspectRatio: ratio }}
		>
			{visible && !rendered && !failed && (
				<output className="absolute inset-x-0 top-0 z-10 block text-center text-xs">
					<span className="inline-block rounded bg-white/95 px-2 py-1 shadow-sm">
						Đang hiển thị trang…
					</span>
				</output>
			)}
			{failed && (
				<p
					role="alert"
					className="absolute inset-x-3 top-3 rounded bg-white/95 p-2 text-center text-sm text-red-700"
				>
					Không thể hiển thị trang PDF này.
				</p>
			)}
			<canvas
				hidden={!hasPage}
				ref={canvas}
				role="img"
				aria-label={`Trang PDF ${hasPage ? displayed.page : page}`}
				className="absolute inset-0 h-full w-full"
			/>
		</div>
	);
}
