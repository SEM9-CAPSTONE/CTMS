import {
	AlertCircle,
	Award,
	Calendar,
	CheckCircle2,
	Clock,
	Edit3,
	Eye,
	Plus,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { ConfirmModal, Modal, Pagination } from "../../../shared/components";
import { CERTIFICATE_TYPE_LABELS } from "../constants";
import { usePorterCertificates } from "../hooks/usePorterCertificates";
import type {
	CreatePorterCertificateInput,
	PorterCertificateItem,
	UpdatePorterCertificateInput,
} from "../types";
import { CertificateDialog } from "./CertificateDialog";

const CERTS_PER_PAGE = 6;

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
	const [previewCert, setPreviewCert] = useState<PorterCertificateItem | null>(null);
	const [page, setPage] = useState(1);

	const totalPages = Math.max(1, Math.ceil(certificates.length / CERTS_PER_PAGE));
	const safePage = Math.min(page, totalPages);
	const visibleCertificates = certificates.slice(
		(safePage - 1) * CERTS_PER_PAGE,
		safePage * CERTS_PER_PAGE
	);

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
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2ed] pb-3.5">
				<h2 id="porter-certificates-title" className="text-base font-bold text-[#10221b]">
					Chứng chỉ & Bằng cấp chuyên môn
				</h2>

				<button
					type="button"
					onClick={handleOpenAdd}
					className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#164027] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#10221b]"
				>
					<Plus size={14} />
					<span>Thêm chứng chỉ</span>
				</button>
			</div>

			{/* Alerts */}
			{successMessage && (
				<output className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
					<CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
					<span>{successMessage}</span>
				</output>
			)}

			{errorMessage && (
				<div
					role="alert"
					className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
				>
					<AlertCircle size={15} className="shrink-0 text-red-600" />
					<span>{errorMessage}</span>
				</div>
			)}

			{/* Compact Certificates Grid */}
			<div className="mt-4">
				{isLoading && (
					<div className="flex justify-center py-6">
						<div className="size-6 animate-spin rounded-full border-3 border-[#164027] border-t-transparent" />
					</div>
				)}

				{!isLoading && certificates.length === 0 && (
					<div className="rounded-xl border border-dashed border-[#dfe8df] p-6 text-center">
						<Award className="mx-auto size-8 text-[#a3b8aa]" />
						<p className="mt-2 text-sm font-semibold text-[#10221b]">Chưa có chứng chỉ nào</p>
						<button
							type="button"
							onClick={handleOpenAdd}
							className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#164027] px-3 py-1.5 text-xs font-semibold text-[#164027] transition hover:bg-[#f4f7f2]"
						>
							<Plus size={14} />
							<span>Thêm chứng chỉ đầu tiên</span>
						</button>
					</div>
				)}

				{!isLoading && certificates.length > 0 && (
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{visibleCertificates.map((cert) => {
								const typeLabel = CERTIFICATE_TYPE_LABELS[cert.certificateType] || "Chứng chỉ";
								const formattedExpiry = new Date(cert.expiryDate).toLocaleDateString("vi-VN");

								return (
									<article
										key={cert.id}
										className="flex flex-col justify-between rounded-xl border border-[#dfe8df] bg-[#fafcfa] p-3.5 transition hover:border-[#b4cbb4]"
									>
										<div>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<span className="block truncate text-[11px] font-medium text-[#627769]">
														{typeLabel}
													</span>
													<h3 className="mt-0.5 text-sm font-bold leading-snug text-[#10221b]">
														{cert.name}
													</h3>
												</div>

												<div className="shrink-0">
													{cert.isExpired ? (
														<span
															aria-label="Trạng thái: Hết hạn"
															className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
														>
															<Clock size={11} className="text-amber-700" />
															<span>Hết hạn</span>
														</span>
													) : cert.status === "verified" ? (
														<span
															aria-label="Trạng thái: Đã xác minh"
															className="inline-flex items-center gap-1 rounded-full border border-[#bcd3c4] bg-[#e3efe7] px-2 py-0.5 text-[11px] font-semibold text-[#164027]"
														>
															<CheckCircle2 size={11} className="text-[#164027]" />
															<span>Đã xác minh</span>
														</span>
													) : cert.status === "pending" ? (
														<span
															aria-label="Trạng thái: Chờ duyệt"
															className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
														>
															<Clock size={11} className="text-blue-600" />
															<span>Chờ duyệt</span>
														</span>
													) : (
														<span
															aria-label="Trạng thái: Bị từ chối"
															className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800"
														>
															<XCircle size={11} className="text-red-600" />
															<span>Bị từ chối</span>
														</span>
													)}
												</div>
											</div>

											<div className="mt-2 space-y-0.5 text-xs text-[#4a5e51]">
												{cert.certificateNumber && (
													<p className="truncate">
														<span className="text-[#627769]">Số hiệu:</span>{" "}
														<span className="font-semibold text-[#10221b]">
															{cert.certificateNumber}
														</span>
													</p>
												)}
												<p className="truncate" title={cert.issuedBy}>
													<span className="text-[#627769]">Đơn vị cấp:</span>{" "}
													<span className="font-medium text-[#10221b]">{cert.issuedBy}</span>
												</p>
												<p className="flex items-center gap-1">
													<Calendar size={12} className="text-[#627769]" />
													<span className="text-[#627769]">Hết hạn:</span>{" "}
													<span
														className={`font-medium ${
															cert.isExpired ? "font-bold text-amber-800" : "text-[#10221b]"
														}`}
													>
														{formattedExpiry}
													</span>
												</p>
											</div>

											{cert.status === "rejected" && cert.rejectionReason && (
												<div className="mt-2 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-2 text-[11px] text-red-800">
													<span className="font-semibold text-red-900">Lý do từ chối: </span>
													<span>{cert.rejectionReason}</span>
												</div>
											)}
										</div>

										{/* Action buttons */}
										<div className="mt-3 flex items-center justify-between border-t border-[#dfe8df]/60 pt-2.5">
											<button
												type="button"
												onClick={() => setPreviewCert(cert)}
												className="inline-flex items-center gap-1 text-xs font-semibold text-[#164027] hover:underline"
											>
												<Eye size={13} />
												<span>Xem ảnh</span>
											</button>

											<div className="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => handleOpenEdit(cert)}
													className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] px-2 py-1 text-xs font-semibold text-[#4a5e51] transition hover:bg-white"
												>
													<Edit3 size={12} />
													<span>{cert.status === "rejected" ? "Sửa lại" : "Sửa"}</span>
												</button>
												<button
													type="button"
													onClick={() => setDeletingCertId(cert.id)}
													aria-label={`Xóa chứng chỉ ${cert.name}`}
													className="rounded-lg p-1 text-[#627769] transition hover:bg-red-50 hover:text-red-700"
												>
													<Trash2 size={14} />
												</button>
											</div>
										</div>
									</article>
								);
							})}
						</div>

						{totalPages > 1 && (
							<Pagination
								currentPage={safePage}
								totalPages={totalPages}
								totalItems={certificates.length}
								itemsPerPage={CERTS_PER_PAGE}
								onPageChange={setPage}
							/>
						)}
					</div>
				)}
			</div>

			{/* Inline Certificate Image Preview Modal */}
			<Modal
				isOpen={Boolean(previewCert)}
				onClose={() => setPreviewCert(null)}
				title={previewCert?.name ?? "Ảnh chứng chỉ"}
				size="xl"
			>
				{previewCert && (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl bg-[#f8faf7] px-4 py-3 text-xs text-[#4a5e51]">
							{previewCert.certificateNumber && (
								<span>
									Số hiệu:{" "}
									<strong className="font-semibold text-[#10221b]">
										{previewCert.certificateNumber}
									</strong>
								</span>
							)}
							<span>
								Đơn vị cấp:{" "}
								<strong className="font-semibold text-[#10221b]">{previewCert.issuedBy}</strong>
							</span>
							<span>
								Hết hạn:{" "}
								<strong className="font-semibold text-[#10221b]">
									{new Date(previewCert.expiryDate).toLocaleDateString("vi-VN")}
								</strong>
							</span>
						</div>

						<div className="overflow-hidden rounded-xl border border-[#dfe8df] bg-[#f8faf7] p-2">
							{previewCert.fileUrl.toLowerCase().endsWith(".pdf") ? (
								<iframe
									src={previewCert.fileUrl}
									title={previewCert.name}
									className="h-[520px] w-full rounded-lg bg-white"
								/>
							) : (
								<img
									src={previewCert.fileUrl}
									alt={previewCert.name}
									className="mx-auto max-h-[560px] w-full rounded-lg object-contain"
								/>
							)}
						</div>
					</div>
				)}
			</Modal>

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
