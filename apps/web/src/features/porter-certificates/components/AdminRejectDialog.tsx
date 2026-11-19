import { AlertCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "../../../shared/components";
import { ADMIN_REJECTION_PRESETS } from "../constants";
import type { PorterCertificateItem } from "../types";

export interface AdminRejectDialogProps {
	isOpen: boolean;
	onClose: () => void;
	certificate: PorterCertificateItem | null;
	onConfirmReject: (id: string, reason: string) => Promise<void>;
	isSubmitting: boolean;
}

export function AdminRejectDialog({
	isOpen,
	onClose,
	certificate,
	onConfirmReject,
	isSubmitting,
}: AdminRejectDialogProps) {
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setReason("");
			setError(null);
		}
	}, [isOpen]);

	if (!certificate) return null;

	const handleSelectPreset = (preset: string) => {
		setReason(preset);
		setError(null);
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		const trimmed = reason.trim();
		if (!trimmed) {
			setError("Vui lòng nhập lý do từ chối để thông báo cho người hỗ trợ.");
			return;
		}

		try {
			await onConfirmReject(certificate.id, trimmed);
			onClose();
		} catch (err: unknown) {
			setError((err as Error).message || "Không thể từ chối chứng chỉ. Vui lòng thử lại.");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Từ chối chứng chỉ chuyên môn"
			size="lg"
			isCloseDisabled={isSubmitting}
		>
			<form onSubmit={handleSubmit} className="space-y-4 text-sm">
				<div className="rounded-xl border border-[#dfe8df] bg-[#f8faf7] p-3 text-xs">
					<p className="text-[#627769]">
						Người hỗ trợ:{" "}
						<strong className="text-[#10221b]">
							{certificate.porter?.fullName || "Chưa có tên"}
						</strong>
					</p>
					<p className="text-[#627769] mt-0.5">
						Chứng chỉ: <strong className="text-[#10221b]">{certificate.name}</strong>
					</p>
				</div>

				{error && (
					<div
						role="alert"
						className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
					>
						<AlertCircle className="size-4 shrink-0 text-red-600" />
						<span>{error}</span>
					</div>
				)}

				<div>
					<label htmlFor="rejection-reason" className="block text-xs font-bold text-[#10221b] mb-1">
						Lý do từ chối <span className="text-red-500">*</span>
					</label>
					<p className="text-xs text-[#627769] mb-2">
						Lý do này sẽ hiển thị trên hồ sơ của người hỗ trợ để họ biết và nộp lại bản chụp mới.
					</p>
					<textarea
						id="rejection-reason"
						rows={3}
						value={reason}
						onChange={(e) => {
							setReason(e.target.value);
							setError(null);
						}}
						placeholder="Nhập chi tiết lý do không duyệt chứng chỉ này..."
						className="w-full rounded-xl border border-[#dfe8df] p-3 text-sm focus:border-red-600 focus:outline-hidden"
					/>
				</div>

				{/* Preset chips for quick rejection */}
				<div>
					<span className="block text-xs font-semibold text-[#627769] mb-1.5">
						Lý do soạn sẵn (bấm để chọn nhanh):
					</span>
					<div className="flex flex-wrap gap-1.5">
						{ADMIN_REJECTION_PRESETS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => handleSelectPreset(preset)}
								className="rounded-lg border border-[#dfe8df] bg-white px-2.5 py-1 text-xs text-[#4a5e51] hover:border-[#164027] hover:text-[#164027] transition text-left"
							>
								{preset}
							</button>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-3 pt-3 border-t border-[#dfe8df]">
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						className="rounded-xl border border-[#dfe8df] px-4 py-2 text-xs font-bold text-[#4a5e51] hover:bg-[#f4f7f2] transition"
					>
						Hủy bỏ
					</button>
					<button
						type="submit"
						disabled={isSubmitting || !reason.trim()}
						className="rounded-xl bg-red-700 px-5 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50 transition"
					>
						{isSubmitting ? "Đang xử lý..." : "Xác nhận từ chối"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
