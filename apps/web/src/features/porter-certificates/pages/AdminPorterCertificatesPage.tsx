import {
	AlertCircle,
	Award,
	Calendar,
	CheckCircle2,
	Clock,
	Eye,
	RefreshCw,
	Search,
	User,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Card, Pagination } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { PorterManagementTabs } from "../../admin-porter-verifications/components/PorterManagementTabs";
import { AdminCertificateDetailDialog } from "../components/AdminCertificateDetailDialog";
import { AdminRejectDialog } from "../components/AdminRejectDialog";
import { CERTIFICATE_TYPE_LABELS } from "../constants";
import {
	type AdminCertificateFilterStatus,
	useAdminPorterCertificates,
} from "../hooks/useAdminPorterCertificates";
import type { PorterCertificateItem } from "../types";

export interface AdminPorterCertificatesPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminPorterCertificatesPage({ onLogout }: AdminPorterCertificatesPageProps) {
	const {
		data: certificates,
		total,
		page,
		limit,
		isLoading,
		errorMessage,
		successMessage,
		status,
		setStatus,
		search,
		setSearch,
		setPage,
		verifyCertificate,
		isVerifying,
		rejectCertificate,
		isRejecting,
		reload,
	} = useAdminPorterCertificates();

	const [selectedCert, setSelectedCert] = useState<PorterCertificateItem | null>(null);
	const [certToReject, setCertToReject] = useState<PorterCertificateItem | null>(null);

	const handleConfirmReject = async (id: string, reason: string) => {
		await rejectCertificate({ id, input: { rejectionReason: reason } });
		setCertToReject(null);
	};

	return (
		<AdminLayout activeItem="porter-verifications" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<PorterManagementTabs active={"certificates" as unknown as "profiles"} />

				{/* Alerts */}
				{errorMessage && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5 shrink-0" />
							{errorMessage}
						</span>
						<button
							type="button"
							onClick={() => void reload()}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-800 transition"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					</div>
				)}

				{successMessage && (
					<output className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
						<CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
						<span>{successMessage}</span>
					</output>
				)}

				{/* Filters & Search */}
				<Card className="p-4 space-y-4 border-[#dfe8df]">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						{/* Status filter pills */}
						<div className="flex flex-wrap items-center gap-1.5" role="tablist">
							{[
								{ key: undefined, label: "Tất cả" },
								{ key: "pending" as AdminCertificateFilterStatus, label: "Chờ duyệt" },
								{ key: "verified" as AdminCertificateFilterStatus, label: "Đã xác minh" },
								{ key: "rejected" as AdminCertificateFilterStatus, label: "Bị từ chối" },
								{ key: "expired" as AdminCertificateFilterStatus, label: "Hết hạn" },
							].map((tab) => {
								const isActive = status === tab.key;
								return (
									<button
										key={tab.label}
										type="button"
										role="tab"
										aria-selected={isActive}
										onClick={() => setStatus(tab.key)}
										className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
											isActive
												? "bg-[#164027] text-white shadow-xs"
												: "bg-[#f4f7f2] text-[#4a5e51] hover:bg-[#dfe8df]"
										}`}
									>
										{tab.label}
									</button>
								);
							})}
						</div>

						{/* Search Input */}
						<div className="relative min-w-[260px]">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#627769]" />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Tìm tên porter, chứng chỉ, số hiệu..."
								className="w-full rounded-xl border border-[#dfe8df] bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#164027] focus:outline-hidden"
							/>
						</div>
					</div>
				</Card>

				{/* Table Card */}
				<Card className="overflow-hidden p-0 border-[#dfe8df]">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm border-collapse">
							<thead>
								<tr className="border-b border-[#dfe8df] bg-[#f8faf7] text-xs font-bold text-[#4a5e51]">
									<th className="py-3 px-4">Người hỗ trợ</th>
									<th className="py-3 px-4">Loại chứng chỉ</th>
									<th className="py-3 px-4">Tên & Số hiệu</th>
									<th className="py-3 px-4">Ngày hết hạn</th>
									<th className="py-3 px-4">Trạng thái</th>
									<th className="py-3 px-4 text-right">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#dfe8df]/70 text-xs">
								{isLoading && (
									<tr>
										<td colSpan={6} className="py-12 text-center text-[#627769]">
											<div className="inline-flex items-center gap-2">
												<div className="size-5 animate-spin rounded-full border-2 border-[#164027] border-t-transparent" />
												<span>Đang tải danh sách chứng chỉ...</span>
											</div>
										</td>
									</tr>
								)}

								{!isLoading && certificates.length === 0 && (
									<tr>
										<td colSpan={6} className="py-12 text-center text-[#627769]">
											<Award className="mx-auto size-8 text-[#a3b8aa] mb-2" />
											<p className="font-semibold text-sm text-[#10221b]">Không có chứng chỉ nào</p>
											<p className="text-xs text-[#627769]">
												{status === "pending"
													? "Hiện không có chứng chỉ nào đang chờ xét duyệt."
													: "Không tìm thấy kết quả phù hợp với bộ lọc hiện tại."}
											</p>
										</td>
									</tr>
								)}

								{!isLoading &&
									certificates.map((cert) => {
										const typeLabel = CERTIFICATE_TYPE_LABELS[cert.certificateType] || "Chứng chỉ";
										const formattedExpiry = new Date(cert.expiryDate).toLocaleDateString("vi-VN");

										return (
											<tr key={cert.id} className="hover:bg-[#f4f7f2]/50 transition">
												{/* Porter name & email */}
												<td className="py-3 px-4">
													<div className="flex items-center gap-2.5">
														<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f2f7] text-[#246b8e]">
															<User size={16} />
														</div>
														<div>
															<p className="font-bold text-[#10221b]">
																{cert.porter?.fullName || "Chưa có tên"}
															</p>
															<p className="text-[11px] text-[#627769]">{cert.porter?.email}</p>
														</div>
													</div>
												</td>

												{/* Type */}
												<td className="py-3 px-4 font-medium text-[#4a5e51]">{typeLabel}</td>

												{/* Name & Cert Number */}
												<td className="py-3 px-4">
													<p className="font-bold text-[#10221b]">{cert.name}</p>
													{cert.certificateNumber && (
														<p className="text-[11px] text-[#627769]">
															Số hiệu: {cert.certificateNumber}
														</p>
													)}
												</td>

												{/* Expiry Date */}
												<td className="py-3 px-4">
													<span
														className={`flex items-center gap-1 font-medium ${
															cert.isExpired ? "text-amber-800 font-bold" : "text-[#10221b]"
														}`}
													>
														<Calendar size={13} className="text-[#627769]" />
														{formattedExpiry}
													</span>
												</td>

												{/* Status Pill with explicit text */}
												<td className="py-3 px-4">
													{cert.isExpired ? (
														<span
															aria-label="Trạng thái: Hết hạn"
															className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-200"
														>
															<Clock size={11} className="text-amber-700" />
															<span>Hết hạn</span>
														</span>
													) : cert.status === "verified" ? (
														<span
															aria-label="Trạng thái: Đã xác minh"
															className="inline-flex items-center gap-1 rounded-full bg-[#e3efe7] px-2.5 py-0.5 text-[11px] font-bold text-[#164027] border border-[#bcd3c4]"
														>
															<CheckCircle2 size={11} className="text-[#164027]" />
															<span>Đã xác minh</span>
														</span>
													) : cert.status === "pending" ? (
														<span
															aria-label="Trạng thái: Chờ duyệt"
															className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200"
														>
															<Clock size={11} className="text-blue-600" />
															<span>Chờ duyệt</span>
														</span>
													) : (
														<span
															aria-label="Trạng thái: Bị từ chối"
															className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-800 border border-red-200"
														>
															<XCircle size={11} className="text-red-600" />
															<span>Bị từ chối</span>
														</span>
													)}
												</td>

												{/* Actions */}
												<td className="py-3 px-4 text-right">
													<button
														type="button"
														onClick={() => setSelectedCert(cert)}
														aria-label={`Xem chi tiết chứng chỉ ${cert.name}`}
														className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-bold text-[#164027] hover:bg-[#f4f7f2] hover:border-[#164027] transition shadow-2xs"
													>
														<Eye size={13} />
														<span>Xem chi tiết</span>
													</button>
												</td>
											</tr>
										);
									})}
							</tbody>
						</table>
					</div>

					{total > limit && (
						<div className="p-4 border-t border-[#dfe8df]">
							<Pagination
								currentPage={page}
								totalPages={Math.ceil(total / limit)}
								totalItems={total}
								itemsPerPage={limit}
								onPageChange={setPage}
							/>
						</div>
					)}
				</Card>
			</div>

			{/* Detail Dialog */}
			<AdminCertificateDetailDialog
				isOpen={Boolean(selectedCert)}
				onClose={() => setSelectedCert(null)}
				certificate={selectedCert}
				onVerify={async (id: string) => {
					await verifyCertificate(id);
				}}
				onOpenReject={(cert) => setCertToReject(cert)}
				isVerifying={isVerifying}
			/>

			{/* Reject Dialog */}
			<AdminRejectDialog
				isOpen={Boolean(certToReject)}
				onClose={() => setCertToReject(null)}
				certificate={certToReject}
				onConfirmReject={handleConfirmReject}
				isSubmitting={isRejecting}
			/>
		</AdminLayout>
	);
}
