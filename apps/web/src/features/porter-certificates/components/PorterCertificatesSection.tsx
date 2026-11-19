import {
	AlertCircle,
	Award,
	Calendar,
	CheckCircle2,
	Clock,
	Edit3,
	ExternalLink,
	Plus,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components";
import { CERTIFICATE_TYPE_LABELS } from "../constants";
import { usePorterCertificates } from "../hooks/usePorterCertificates";
import type {
	CreatePorterCertificateInput,
	PorterCertificateItem,
	UpdatePorterCertificateInput,
} from "../types";
import { CertificateDialog } from "./CertificateDialog";

export function PorterCertificatesSection() {
	const {
		certificates,
		isLoading,
		errorMessage,
		successMessage,
		clearMessages,
		createCertificate,
		isCreating,
		updateCertificate,
		isUpdating,
		deleteCertificate,
		isDeleting,
	} = usePorterCertificates();

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingCert, setEditingCert] = useState<PorterCertificateItem | null>(null);
	const [deletingCertId, setDeletingCertId] = useState<string | null>(null);

	const handleOpenAdd = () => {
		clearMessages();
		setEditingCert(null);
		setIsDialogOpen(true);
	};

	const handleOpenEdit = (cert: PorterCertificateItem) => {
		clearMessages();
		setEditingCert(cert);
		setIsDialogOpen(true);
	};

	const handleFormSubmit = async (
		input: CreatePorterCertificateInput | UpdatePorterCertificateInput
	) => {
		if (editingCert) {
			await updateCertificate({ id: editingCert.id, input });
		} else {
			await createCertificate(input as CreatePorterCertificateInput);
		}
	};

	const handleDeleteConfirm = async () => {
		if (!deletingCertId) return;
		await deleteCertificate(deletingCertId);
		setDeletingCertId(null);
	};

	return (
		<section
			id="porter-certificates-section"
			aria-labelledby="porter-certificates-title"
			className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs"
		>
			{/* Section Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#dfe8df] pb-4">
				<div>
					<div className="flex items-center gap-2">
						<Award className="size-5 text-[#164027]" />
						<h2 id="porter-certificates-title" className="text-base font-bold text-[#10221b]">
							Chứng chỉ & Bằng cấp chuyên môn
						</h2>
					</div>
					<p className="mt-1 text-xs text-[#627769]">
						Quản lý chứng chỉ sơ cấp cứu, cứu hộ và thẻ hướng dẫn viên để phục vụ xét duyệt cấp độ
						và làm Lead.
					</p>
				</div>

				<button
					type="button"
					onClick={handleOpenAdd}
					className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#164027] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#10221b] transition shadow-xs self-start sm:self-auto"
				>
					<Plus size={15} />
					<span>Thêm chứng chỉ</span>
				</button>
			</div>

			{/* Alerts */}
			{successMessage && (
				<output className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
					<CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
					<span>{successMessage}</span>
				</output>
			)}

			{errorMessage && (
				<div
					role="alert"
					className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800"
				>
					<AlertCircle size={16} className="shrink-0 text-red-600" />
					<span>{errorMessage}</span>
				</div>
			)}

			{/* Certificates Grid / List */}
			<div className="mt-4">
				{isLoading && (
					<div className="flex justify-center py-8">
						<div className="size-7 animate-spin rounded-full border-3 border-[#164027] border-t-transparent" />
					</div>
				)}

				{!isLoading && certificates.length === 0 && (
					<div className="rounded-xl border border-dashed border-[#dfe8df] p-8 text-center">
						<Award className="mx-auto size-10 text-[#a3b8aa]" />
						<p className="mt-2 text-sm font-semibold text-[#10221b]">Chưa có chứng chỉ nào</p>
						<p className="mt-1 text-xs text-[#627769]">
							Tải lên chứng chỉ sơ cấp cứu (WFA), cứu hộ hoặc thẻ hướng dẫn viên để hoàn thiện hồ
							sơ.
						</p>
						<button
							type="button"
							onClick={handleOpenAdd}
							className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#164027] px-3.5 py-2 text-xs font-bold text-[#164027] hover:bg-[#f4f7f2] transition"
						>
							<Plus size={14} />
							<span>Thêm chứng chỉ đầu tiên</span>
						</button>
					</div>
				)}

				{!isLoading && certificates.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{certificates.map((cert) => {
							const typeLabel = CERTIFICATE_TYPE_LABELS[cert.certificateType] || "Chứng chỉ";
							const formattedExpiry = new Date(cert.expiryDate).toLocaleDateString("vi-VN");

							return (
								<article
									key={cert.id}
									className="flex flex-col justify-between rounded-xl border border-[#dfe8df] bg-[#fafcfa] p-4 transition hover:border-[#b4cbb4] hover:shadow-xs"
								>
									<div>
										<div className="flex items-start justify-between gap-2">
											<div>
												<span className="text-[11px] font-semibold text-[#627769]">
													{typeLabel}
												</span>
												<h3 className="text-sm font-bold text-[#10221b] leading-tight">
													{cert.name}
												</h3>
											</div>

											{/* Status badge with text */}
											<div>
												{cert.isExpired ? (
													<span
														aria-label="Trạng thái: Hết hạn"
														className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-200"
													>
														<Clock size={12} className="text-amber-700" />
														<span>Hết hạn</span>
													</span>
												) : cert.status === "verified" ? (
													<span
														aria-label="Trạng thái: Đã xác minh"
														className="inline-flex items-center gap-1 rounded-full bg-[#e3efe7] px-2.5 py-0.5 text-[11px] font-bold text-[#164027] border border-[#bcd3c4]"
													>
														<CheckCircle2 size={12} className="text-[#164027]" />
														<span>Đã xác minh</span>
													</span>
												) : cert.status === "pending" ? (
													<span
														aria-label="Trạng thái: Chờ duyệt"
														className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200"
													>
														<Clock size={12} className="text-blue-600" />
														<span>Chờ duyệt</span>
													</span>
												) : (
													<span
														aria-label="Trạng thái: Bị từ chối"
														className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-800 border border-red-200"
													>
														<XCircle size={12} className="text-red-600" />
														<span>Bị từ chối</span>
													</span>
												)}
											</div>
										</div>

										<div className="mt-2.5 space-y-1 text-xs text-[#4a5e51]">
											{cert.certificateNumber && (
												<p>
													<span className="text-[#627769]">Số hiệu:</span>{" "}
													<span className="font-medium text-[#10221b]">
														{cert.certificateNumber}
													</span>
												</p>
											)}
											<p>
												<span className="text-[#627769]">Đơn vị cấp:</span>{" "}
												<span className="font-medium text-[#10221b]">{cert.issuedBy}</span>
											</p>
											<p className="flex items-center gap-1">
												<Calendar size={13} className="text-[#627769]" />
												<span className="text-[#627769]">Hết hạn:</span>{" "}
												<span
													className={`font-medium ${
														cert.isExpired ? "text-amber-800 font-bold" : "text-[#10221b]"
													}`}
												>
													{formattedExpiry}
												</span>
											</p>
										</div>

										{/* Rejection reason display if rejected */}
										{cert.status === "rejected" && cert.rejectionReason && (
											<div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-2.5 text-xs text-red-800">
												<p className="font-bold text-[11px] text-red-900 mb-0.5">Lý do từ chối:</p>
												<p className="leading-snug">{cert.rejectionReason}</p>
											</div>
										)}
									</div>

									{/* Action buttons */}
									<div className="mt-4 flex items-center justify-between border-t border-[#dfe8df]/60 pt-3">
										<a
											href={cert.fileUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-xs font-bold text-[#164027] hover:underline"
										>
											<ExternalLink size={13} />
											<span>Xem ảnh/tệp</span>
										</a>

										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => handleOpenEdit(cert)}
												className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] px-2.5 py-1 text-xs font-bold text-[#4a5e51] hover:bg-white transition"
											>
												<Edit3 size={13} />
												<span>{cert.status === "rejected" ? "Sửa lại" : "Sửa"}</span>
											</button>
											<button
												type="button"
												onClick={() => setDeletingCertId(cert.id)}
												aria-label={`Xóa chứng chỉ ${cert.name}`}
												className="rounded-lg p-1 text-[#627769] hover:bg-red-50 hover:text-red-700 transition"
											>
												<Trash2 size={15} />
											</button>
										</div>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>

			{/* Dialogs */}
			<CertificateDialog
				isOpen={isDialogOpen}
				onClose={() => {
					setIsDialogOpen(false);
					setEditingCert(null);
				}}
				certificateToEdit={editingCert}
				onSubmit={handleFormSubmit}
				isSubmitting={isCreating || isUpdating}
			/>

			<ConfirmModal
				isOpen={Boolean(deletingCertId)}
				onClose={() => setDeletingCertId(null)}
				onConfirm={handleDeleteConfirm}
				title="Xóa chứng chỉ"
				description="Bạn có chắc chắn muốn xóa chứng chỉ này khỏi hồ sơ? Chứng chỉ đã xóa sẽ không còn được sử dụng để xét duyệt cấp độ."
				confirmText="Xác nhận xóa"
				variant="danger"
				isLoading={isDeleting}
			/>
		</section>
	);
}
