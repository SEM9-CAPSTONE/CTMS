import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { buttonClass } from "./constants";
import { analysisService } from "./service";

interface QuarantinedImageModalProps {
	reviewId: string;
	imageIndex: number;
	onClose: () => void;
}

export function QuarantinedImageModal({
	reviewId,
	imageIndex,
	onClose,
}: QuarantinedImageModalProps) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		let activeUrl: string | null = null;

		async function fetchImage() {
			setLoading(true);
			setError(null);
			try {
				const blob = await analysisService.getQuarantinedImageBlob(
					reviewId,
					imageIndex,
					controller.signal
				);
				activeUrl = URL.createObjectURL(blob);
				setBlobUrl(activeUrl);
			} catch (err: unknown) {
				if (controller.signal.aborted) return;
				if (err instanceof HttpError) {
					if (err.status === 403) {
						setError("Bạn không có quyền xem bằng chứng của đánh giá này.");
					} else if (err.status === 404) {
						setError("Không tìm thấy tệp ảnh trên hệ thống lưu trữ.");
					} else if (err.status === 409) {
						setError("Tệp ảnh đang trong quá trình xử lý lưu trữ. Vui lòng thử lại sau giây lát.");
					} else {
						setError(err.message || "Không thể tải ảnh bằng chứng.");
					}
				} else {
					setError("Lỗi kết nối khi tải ảnh bằng chứng.");
				}
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		}

		void fetchImage();

		return () => {
			controller.abort();
			if (activeUrl) {
				URL.revokeObjectURL(activeUrl);
			}
		};
	}, [reviewId, imageIndex]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: custom accessible modal backdrop
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="quarantine-image-title"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		>
			<div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
				<header className="flex items-center justify-between border-b border-[#dfe8df] px-5 py-4">
					<h2 id="quarantine-image-title" className="text-base font-bold text-[#10221b]">
						Ảnh bằng chứng kiểm duyệt
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng"
						className="rounded-lg p-1.5 text-[#53674d] hover:bg-[#f0f5ed] hover:text-[#10221b]"
					>
						<X className="size-5" />
					</button>
				</header>

				<div className="flex flex-1 items-center justify-center overflow-auto p-5">
					{loading && (
						<div className="flex flex-col items-center gap-3 py-16 text-[#53674d]">
							<Loader2 className="size-8 animate-spin text-[#164027]" />
							<p className="text-sm">Đang tải ảnh bằng chứng…</p>
						</div>
					)}

					{!loading && error && (
						<div
							role="alert"
							className="flex flex-col items-center gap-3 py-12 text-center text-rose-800"
						>
							<AlertTriangle className="size-8 text-rose-600" />
							<p className="text-sm font-medium">{error}</p>
						</div>
					)}

					{!loading && !error && blobUrl && (
						<div className="flex flex-col items-center gap-3">
							<img
								src={blobUrl}
								alt="Ảnh bằng chứng vi phạm"
								className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain shadow-sm"
							/>
							<p className="text-xs text-[#728070]">
								Ảnh này đã được tạm ẩn khỏi giao diện công khai để đảm bảo tiêu chuẩn cộng đồng.
							</p>
						</div>
					)}
				</div>

				<footer className="flex justify-end border-t border-[#dfe8df] bg-[#f9faf8] px-5 py-3">
					<button type="button" onClick={onClose} className={buttonClass}>
						Đóng
					</button>
				</footer>
			</div>
		</div>
	);
}
