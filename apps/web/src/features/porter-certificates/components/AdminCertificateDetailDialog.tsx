import {
	AlertCircle,
	CheckCircle2,
	Clock,
	ExternalLink,
	FileText,
	ShieldCheck,
	User,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Modal } from "../../../shared/components";
import { CERTIFICATE_STATUS_LABELS, CERTIFICATE_TYPE_LABELS } from "../constants";
import type { PorterCertificateItem } from "../types";

export interface AdminCertificateDetailDialogProps {
	isOpen: boolean;
	onClose: () => void;
	certificate: PorterCertificateItem | null;
	onVerify: (id: string) => Promise<void>;
	onOpenReject: (cert: PorterCertificateItem) => void;
	isVerifying: boolean;
}

export function AdminCertificateDetailDialog({
	isOpen,
	onClose,
	certificate,
	onVerify,
	onOpenReject,
	isVerifying,
}: AdminCertificateDetailDialogProps) {
	const [imgError, setImgError] = useState(false);
	const [prevId, setPrevId] = useState<string | null>(null);

	const currentId = certificate?.id ?? null;
	if (currentId !== prevId) {
		setPrevId(currentId);
		setImgError(false);
	}

	if (!certificate) return null;

	const typeLabel = CERTIFICATE_TYPE_LABELS[certificate.certificateType] || "Chứng chỉ";
	const formattedExpiry = new Date(certificate.expiryDate).toLocaleDateString("vi-VN");
	const formattedIssue = certificate.issueDate
		? new Date(certificate.issueDate).toLocaleDateString("vi-VN")
		: "Chưa cung cấp";

	const isImage =
		certificate.fileUrl.endsWith(".jpg") ||
		certificate.fileUrl.endsWith(".jpeg") ||
		certificate.fileUrl.endsWith(".png") ||
		certificate.fileUrl.endsWith(".webp") ||
		certificate.fileUrl.includes("/uploads/certificates/");

	const handleVerifyClick = async () => {
		await onVerify(certificate.id);
		onClose();
	};

	const handleRejectClick = () => {
		onClose();
		onOpenReject(certificate);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Chi tiết chứng chỉ người hỗ trợ"
			size="xl"
			isCloseDisabled={isVerifying}
		>
			<div className="space-y-5 text-sm">
				{/* Top Status & Porter Info */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4">
					<div className="flex items-center gap-3">
						<div className="flex size-11 items-center justify-center rounded-xl bg-[#e6f2f7] text-[#246b8e]">
							<User size={22} />
						</div>
						<div>
							<h3 className="font-bold text-[#10221b] text-base">
								{certificate.porter?.fullName || "Chưa có tên"}
							</h3>
							<p className="text-xs text-[#627769]">{certificate.porter?.email}</p>
							{certificate.porter?.phone && (
								<p className="text-xs text-[#627769]">SĐT: {certificate.porter.phone}</p>
							)}
						</div>
					</div>

					<div className="self-start sm:self-auto">
						{certificate.isExpired ? (
							<span
								aria-label="Trạng thái: Hết hạn"
								className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300"
							>
								<Clock size={13} className="text-amber-700" />
								<span>Đã hết hạn</span>
							</span>
						) : certificate.status === "verified" ? (
							<span
								aria-label="Trạng thái: Đã xác minh"
								className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300"
							>
								<CheckCircle2 size={13} className="text-emerald-600" />
								<span>{CERTIFICATE_STATUS_LABELS.verified}</span>
							</span>
						) : certificate.status === "pending" ? (
							<span
								aria-label="Trạng thái: Chờ duyệt"
								className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-300"
							>
								<Clock size={13} className="text-blue-600" />
								<span>{CERTIFICATE_STATUS_LABELS.pending}</span>
							</span>
						) : (
							<span
								aria-label="Trạng thái: Bị từ chối"
								className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800 border border-red-300"
							>
								<XCircle size={13} className="text-red-600" />
								<span>{CERTIFICATE_STATUS_LABELS.rejected}</span>
							</span>
						)}
					</div>
				</div>

				{/* Metadata Details */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Loại chứng chỉ:</span>
						<p className="font-bold text-[#10221b] text-sm mt-0.5">{typeLabel}</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Tên chứng chỉ:</span>
						<p className="font-bold text-[#10221b] text-sm mt-0.5">{certificate.name}</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Số hiệu chứng chỉ:</span>
						<p className="font-bold text-[#10221b] text-sm mt-0.5">
							{certificate.certificateNumber || "Không có"}
						</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Đơn vị cấp bằng:</span>
						<p className="font-bold text-[#10221b] text-sm mt-0.5">{certificate.issuedBy}</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Ngày cấp:</span>
						<p className="font-bold text-[#10221b] text-sm mt-0.5">{formattedIssue}</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
						<span className="text-[#627769]">Ngày hết hạn:</span>
						<p
							className={`font-bold text-sm mt-0.5 ${
								certificate.isExpired ? "text-amber-800" : "text-[#10221b]"
							}`}
						>
							{formattedExpiry} {certificate.isExpired && "(Đã quá hạn)"}
						</p>
					</div>
				</div>

				{/* Rejection Note if rejected */}
				{certificate.status === "rejected" && certificate.rejectionReason && (
					<div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
						<div className="flex items-center gap-1.5 font-bold mb-1">
							<AlertCircle className="size-4 shrink-0 text-red-600" />
							<span>Lý do đã từ chối:</span>
						</div>
						<p className="ml-5 leading-relaxed">{certificate.rejectionReason}</p>
					</div>
				)}

				{/* Certificate Media View */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-[#10221b]">Ảnh / Tài liệu chứng chỉ:</span>
						<a
							href={certificate.fileUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 text-xs font-bold text-[#164027] hover:underline"
						>
							<ExternalLink size={13} />
							<span>Mở tệp đầy đủ trong tab mới</span>
						</a>
					</div>

					<div className="flex items-center justify-center rounded-2xl border border-[#dfe8df] bg-[#f0f4f0] p-4 min-h-[220px]">
						{isImage && !imgError ? (
							<img
								src={certificate.fileUrl}
								alt={`Chứng chỉ ${certificate.name}`}
								className="max-h-80 max-w-full rounded-xl object-contain shadow-xs bg-white border border-[#dfe8df]"
								onError={() => setImgError(true)}
							/>
						) : imgError ? (
							<div className="text-center py-6">
								<AlertCircle className="mx-auto size-10 text-amber-600" />
								<p className="mt-2 text-xs font-bold text-[#10221b]">
									Không tải được hình ảnh chứng chỉ
								</p>
								<p className="text-xs text-[#627769] mt-0.5">
									Tệp minh chứng có thể không tồn tại hoặc đường dẫn không còn khả dụng
								</p>
							</div>
						) : (
							<div className="text-center py-6">
								<FileText className="mx-auto size-12 text-[#164027]" />
								<p className="mt-2 text-xs font-bold text-[#10221b]">Tài liệu PDF chứng chỉ</p>
								<p className="text-xs text-[#627769] mt-0.5">
									Bấm nút bên trên để mở xem nội dung PDF
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Action Footer */}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#dfe8df]">
					<button
						type="button"
						onClick={onClose}
						disabled={isVerifying}
						className="w-full sm:w-auto rounded-xl border border-[#dfe8df] px-4 py-2 text-xs font-bold text-[#4a5e51] hover:bg-[#f4f7f2] transition"
					>
						Đóng lại
					</button>

					{certificate.status === "pending" && (
						<div className="flex items-center gap-2.5 w-full sm:w-auto">
							<button
								type="button"
								onClick={handleRejectClick}
								disabled={isVerifying}
								className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
							>
								<XCircle size={14} />
								<span>Từ chối chứng chỉ</span>
							</button>

							<button
								type="button"
								onClick={handleVerifyClick}
								disabled={isVerifying}
								className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white hover:bg-[#10221b] disabled:opacity-50 transition shadow-xs"
							>
								<ShieldCheck size={14} />
								<span>{isVerifying ? "Đang xử lý..." : "Xác minh chứng chỉ"}</span>
							</button>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}
