import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useState } from "react";

export function usePdfDocument(blob?: Blob) {
	const [result, setResult] = useState<{
		blob: Blob;
		document?: PDFDocumentProxy;
		failed?: boolean;
	}>();
	useEffect(() => {
		if (!blob) return;
		let active = true;
		let task: PDFDocumentLoadingTask | undefined;
		async function load(file: Blob) {
			const [pdf, data] = await Promise.all([import("pdfjs-dist"), file.arrayBuffer()]);
			if (!active) return;
			pdf.GlobalWorkerOptions.workerSrc = workerUrl;
			task = pdf.getDocument({ data, isEvalSupported: false, enableXfa: false });
			const document = await task.promise;
			if (active) setResult({ blob: file, document });
		}
		void load(blob).catch(() => {
			if (active) setResult({ blob, failed: true });
		});
		return () => {
			active = false;
			void task?.destroy().catch(() => undefined);
		};
	}, [blob]);
	return result?.blob === blob ? result : undefined;
}
