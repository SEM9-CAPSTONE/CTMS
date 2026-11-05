import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { PdfCanvas } from "./PdfCanvas";

export function PdfPages({ document, zoom }: { document: PDFDocumentProxy; zoom: number }) {
	const scrollport = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [ratio, setRatio] = useState<number>();
	const [failed, setFailed] = useState(false);
	const pages = Array.from({ length: document.numPages }, (_, index) => index + 1);
	useEffect(() => {
		let active = true;
		void document
			.getPage(1)
			.then((page) => {
				const viewport = page.getViewport({ scale: 1 });
				if (active) setRatio(viewport.width / viewport.height);
			})
			.catch(() => {
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, [document]);
	useEffect(() => {
		const element = scrollport.current;
		if (!element) return;
		const measure = () => setWidth(Math.max(0, element.clientWidth - 24));
		measure();
		let resizeTimer: ReturnType<typeof setTimeout>;
		const observer = new ResizeObserver(() => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(measure, 80);
		});
		observer.observe(element);
		return () => {
			clearTimeout(resizeTimer);
			observer.disconnect();
		};
	}, []);
	return (
		<div
			ref={scrollport}
			aria-label="Các trang PDF"
			className="h-full space-y-3 overflow-x-auto overflow-y-scroll p-3"
			style={{ scrollbarGutter: "stable" }}
		>
			{failed && (
				<p role="alert" className="text-center text-sm text-red-700">
					Không thể đọc các trang PDF.
				</p>
			)}
			{!failed && (!width || !ratio) && (
				<output className="block text-center text-sm">Đang hiển thị PDF…</output>
			)}
			{!!width &&
				!!ratio &&
				pages.map((page) => (
					<PdfCanvas
						key={page}
						document={document}
						page={page}
						zoom={zoom}
						width={width}
						aspectRatio={ratio}
						scrollRoot={scrollport}
					/>
				))}
		</div>
	);
}
