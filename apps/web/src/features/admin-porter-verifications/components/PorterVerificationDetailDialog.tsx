import { AlertCircle, BadgeCheck, Loader2, ShieldX, UserRound } from "lucide-react";
import { useState } from "react";
import {
	Button,
	ConfirmModal,
	DocumentPreview,
	Modal,
	StatusBadge,
} from "../../../shared/components";
import {
	PORTER_VERIFICATION_STATUS_LABELS,
	PORTER_VERIFICATION_STATUS_TONES,
} from "../../porter-verification/constants";
import type { AdminPorterVerificationDetail } from "../types";

const REJECTION_REASON_MAX = 500;

export interface PorterVerificationDetailDialogProps {
	open: boolean;
	detail: AdminPorterVerificationDetail | null;
	isLoading: boolean;
	isReviewing: boolean;
	errorMessage: string | null;
	onClose: () => void;
	onApprove: () => Promise<boolean>;
	onReject: (reason: string) => Promise<boolean>;
}

function formatDateTime(value: string | null): string {
	return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-xs font-bold text-[#667a6d]">{label}</dt>
			<dd className="text-sm font-semibold text-[#10221b]">{value}</dd>
		</div>
	);
}

export function PorterVerificationDetailDialog({
	open,
	detail,
	isLoading,
	isReviewing,
	errorMessage,
	onClose,
	onApprove,
	onReject,
}: PorterVerificationDetailDialogProps) {
	const [approveOpen, setApproveOpen] = useState(false);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [reason, setReason] = useState("");
	const trimmedReason = reason.trim();
	const canReview = detail?.status === "pending_review";

	const closeReject = () => {
		if (isReviewing) return;
		setRejectOpen(false);
		setReason("");
	};

	return (
		<>
			<Modal
				isOpen={open}
				onClose={onClose}
				title="Hồ sơ xác minh Porter"
				icon={<UserRound className="size-5" />}
				description={detail ? (detail.fullName ?? detail.email ?? undefined) : undefined}
				size="xl"
				isCloseDisabled={isReviewing}
			>
				{isLoading ? (
					<div className="flex items-center justify-center gap-3 py-12 text-sm font-bold text-[#54655a]">
						<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải hồ sơ...
					</div>
				) : !detail ? (
					errorMessage && (
						<p role="alert" className="text-sm font-bold text-red-700">
							{errorMessage}
						</p>
					)
				) : (
					<div className="space-y-5">
						<div className="flex flex-wrap items-center gap-2">
							<StatusBadge tone={PORTER_VERIFICATION_STATUS_TONES[detail.status]}>
								{PORTER_VERIFICATION_STATUS_LABELS[detail.status]}
							</StatusBadge>
							{detail.submittedAt && (
								<span className="text-xs font-medium text-[#667a6d]">
									Nộp lúc {formatDateTime(detail.submittedAt)}
								</span>
							)}
						</div>

						<dl className="grid grid-cols-1 gap-3 rounded-xl border border-[#e0ebe0] bg-[#f7faf6] p-4 sm:grid-cols-2">
							<InfoRow label="Họ tên" value={detail.fullName ?? "—"} />
							<InfoRow label="Email" value={detail.email ?? "—"} />
							<InfoRow label="Số điện thoại" value={detail.phone ?? "—"} />
							<InfoRow
								label="Kinh nghiệm"
								value={detail.experienceYears === null ? "—" : `${detail.experienceYears} năm`}
							/>
							<div className="sm:col-span-2">
								<InfoRow
									label="Chứng chỉ khai báo trong hồ sơ"
									value={detail.certifications.length ? detail.certifications.join(", ") : "—"}
								/>
							</div>
						</dl>

						{detail.status === "rejected" && detail.rejectionReason && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
								<span className="font-bold">Lý do từ chối: </span>
								{detail.rejectionReason}
							</div>
						)}

						<section aria-label="Tài liệu chứng chỉ" className="space-y-2">
							<h3 className="text-sm font-extrabold">
								Tài liệu chứng chỉ ({detail.documents.length})
							</h3>
							{detail.documents.length === 0 ? (
								<p className="text-sm text-[#667a6d]">Porter chưa tải tài liệu nào.</p>
							) : (
								<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
									{detail.documents.map((document) => (
										<DocumentPreview
											key={document.id}
											url={document.fileUrl}
											name={document.originalName}
											mimeType={document.mimeType}
											sizeBytes={document.sizeBytes}
										/>
									))}
								</div>
							)}
						</section>

						{errorMessage && (
							<div
								role="alert"
								className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700"
							>
								<AlertCircle className="size-4" />
								{errorMessage}
							</div>
						)}

						{canReview && (
							<div className="flex flex-col-reverse gap-2 border-t border-[#e0ebe0] pt-4 sm:flex-row sm:justify-end">
								<Button
									type="button"
									variant="outline"
									disabled={isReviewing}
									onClick={() => setRejectOpen(true)}
									className="border-red-300 text-red-700 hover:bg-red-50"
								>
									<ShieldX className="mr-1.5 inline size-4" /> Từ chối
								</Button>
								<Button type="button" disabled={isReviewing} onClick={() => setApproveOpen(true)}>
									<BadgeCheck className="mr-1.5 inline size-4" /> Duyệt hồ sơ
								</Button>
							</div>
						)}
					</div>
				)}
			</Modal>

			<ConfirmModal
				isOpen={approveOpen}
				onClose={() => setApproveOpen(false)}
				onConfirm={async () => {
					if (await onApprove()) setApproveOpen(false);
				}}
				title="Duyệt hồ sơ Porter?"
				description="Porter sẽ được phép bật trạng thái sẵn sàng và nhận yêu cầu dẫn đoàn từ Host."
				confirmText="Duyệt"
				variant="success"
				isLoading={isReviewing}
			/>

			<Modal
				isOpen={rejectOpen}
				onClose={closeReject}
				title="Từ chối hồ sơ"
				icon={<ShieldX className="size-5" />}
				description="Lý do sẽ được hiển thị cho Porter để họ bổ sung và nộp lại."
				size="md"
				isCloseDisabled={isReviewing}
			>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						if (!trimmedReason) return;
						if (await onReject(trimmedReason)) closeReject();
					}}
					className="space-y-3"
				>
					<label className="block">
						<span className="mb-1 block text-xs font-bold text-[#425048]">Lý do từ chối *</span>
						<textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							maxLength={REJECTION_REASON_MAX}
							rows={4}
							placeholder="VD: Ảnh chứng chỉ bị mờ, vui lòng chụp lại rõ thông tin."
							className="w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm outline-none focus:border-[#164027]"
						/>
						<span className="text-xs text-[#667a6d]">
							{reason.length}/{REJECTION_REASON_MAX}
						</span>
					</label>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="ghost" onClick={closeReject} disabled={isReviewing}>
							Hủy
						</Button>
						<Button
							type="submit"
							disabled={!trimmedReason || isReviewing}
							className="bg-red-700 hover:bg-red-800"
						>
							{isReviewing ? "Đang xử lý..." : "Xác nhận từ chối"}
						</Button>
					</div>
				</form>
			</Modal>
		</>
	);
}
