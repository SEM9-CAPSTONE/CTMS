import { Download, FileText, Maximize, ZoomIn } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "../../../shared/components/Toast";
import { usePdfDocument } from "../hooks/usePdfDocument";
import { PdfPages } from "./PdfPages";

interface DocumentPreviewProps {
	blob?: Blob;
	filename: string;
	downloadUrl?: string | null;
	pending?: boolean;
	error?: string;
	onRetry?: () => void;
}

const iconButton = "rounded-md p-2 hover:bg-[#f4f7f2] disabled:opacity-40";
const zoomLevels = [1, 1.25, 1.5, 2];

export function DocumentPreview({
	blob,
	filename,
	downloadUrl,
	pending,
	error,
	onRetry,
}: DocumentPreviewProps) {
	const viewer = useRef<HTMLElement>(null);
	const [zoomIndex, setZoomIndex] = useState(0);
	const result = usePdfDocument(blob);
	const pdf = result?.document;
	const failed = error || (result?.failed ? "Không thể đọc tệp PDF này." : undefined);
	const loading = pending || (!!blob && !result);
	const zoom = zoomLevels[zoomIndex];
	const pageCount = pdf?.numPages ?? 0;
	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await viewer.current?.requestFullscreen();
		} catch {
			toast.info("Trình duyệt không thể mở chế độ toàn màn hình.");
		}
	}
	return (
		<section
			ref={viewer}
			aria-label="Nội dung PDF"
			onKeyDownCapture={(event) => {
				if (event.key === "Escape" && document.fullscreenElement === viewer.current) {
					event.preventDefault();
					event.stopPropagation();
					void toggleFullscreen();
				}
			}}
			className="min-w-0 overflow-hidden rounded-xl border border-[#dfe8df] bg-white fullscreen:flex fullscreen:flex-col"
		>
			<header className="flex items-center justify-between gap-2 px-3 py-2">
				<h3 className="text-sm font-bold">Nội dung PDF</h3>
				<div className="flex items-center">
					<button
						type="button"
						className={iconButton}
						disabled={!pdf}
						aria-label={`Phóng to PDF (${zoom * 100}%)`}
						onClick={() => setZoomIndex((index) => (index + 1) % zoomLevels.length)}
					>
						<ZoomIn size={16} aria-hidden="true" />
					</button>
					{downloadUrl && (
						<a
							href={downloadUrl}
							download={filename}
							className={iconButton}
							aria-label="Tải PDF về máy"
						>
							<Download size={16} aria-hidden="true" />
						</a>
					)}
					<button
						type="button"
						className={iconButton}
						disabled={!pdf}
						aria-label="Toàn màn hình PDF"
						onClick={() => void toggleFullscreen()}
					>
						<Maximize size={16} aria-hidden="true" />
					</button>
				</div>
			</header>
			<div className="h-[clamp(18rem,48vh,34rem)] min-h-0 flex-1 bg-[#eef2ee]">
				{pdf ? (
					<PdfPages document={pdf} zoom={zoom} />
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[#526c5e]">
						<FileText aria-hidden="true" size={28} />
						{loading && <output>Đang tải PDF…</output>}
						{failed && <p role="alert">{failed}</p>}
						{failed && error && onRetry && (
							<button type="button" className="font-semibold underline" onClick={onRetry}>
								Thử tải lại
							</button>
						)}
					</div>
				)}
			</div>
			<footer className="flex items-center justify-between gap-2 px-3 py-1 text-sm">
				<span className="text-[#526c5e]">Xem trước tài liệu</span>
				{pdf && <span>{pageCount} trang</span>}
			</footer>
		</section>
	);
}
