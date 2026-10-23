import {
	AlertCircle,
	BadgeCheck,
	Clock3,
	FileBadge,
	Loader2,
	RefreshCw,
	Send,
	ShieldAlert,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
	Button,
	ConfirmModal,
	DocumentPreview,
	FileDropzone,
	StatusBadge,
	formatFileSize,
} from "../../../shared/components";
import { LogoutActions } from "../../auth/components/LogoutActions";
import { RegisterStepper } from "../../auth/components/RegisterStepper";
import { PORTER_REGISTER_STEPS } from "../../auth/constants";
import { PorterQualificationGuidance } from "../components/PorterQualificationGuidance";
import {
	PORTER_VERIFICATION_MAX_DOCUMENTS,
	PORTER_VERIFICATION_MAX_FILE_BYTES,
	PORTER_VERIFICATION_MIME_TYPES,
	PORTER_VERIFICATION_STATUS_LABELS,
	PORTER_VERIFICATION_STATUS_TONES,
} from "../constants";
import { usePorterVerification } from "../hooks/usePorterVerification";
import type { PorterVerification } from "../types";

export interface PorterVerificationPageProps {
	onLogout: (allDevices: boolean) => Promise<void>;
	onContinue: () => void;
}

function formatDateTime(value: string | null): string {
	return value ? new Date(value).toLocaleString("vi-VN") : "";
}

function StatusPanel({
	verification,
	onContinue,
}: {
	verification: PorterVerification;
	onContinue: () => void;
}): ReactNode {
	switch (verification.status) {
		case "approved":
			return (
				<div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3 text-emerald-800">
						<BadgeCheck className="mt-0.5 size-5 shrink-0" />
						<div>
							<p className="text-sm font-extrabold">Hồ sơ đã được duyệt</p>
							<p className="text-xs font-medium">
								Bạn có thể bật trạng thái sẵn sàng và nhận yêu cầu dẫn đoàn.
							</p>
						</div>
					</div>
					<Button type="button" onClick={onContinue}>
						Vào trang Porter
					</Button>
				</div>
			);
		case "pending_review":
			return (
				<div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
					<Clock3 className="mt-0.5 size-5 shrink-0" />
					<div>
						<p className="text-sm font-extrabold">Hồ sơ đang chờ Admin duyệt</p>
						<p className="text-xs font-medium">
							Đã nộp lúc {formatDateTime(verification.submittedAt)}. Bạn sẽ dùng được các chức năng
							Porter ngay sau khi hồ sơ được duyệt.
						</p>
					</div>
				</div>
			);
		case "rejected":
			return (
				<div
					role="alert"
					className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
				>
					<ShieldAlert className="mt-0.5 size-5 shrink-0" />
					<div>
						<p className="text-sm font-extrabold">Hồ sơ bị từ chối</p>
						<p className="text-xs font-medium">Lý do: {verification.rejectionReason}</p>
						<p className="mt-1 text-xs font-medium">
							Hãy cập nhật lại tài liệu theo góp ý và nộp lại hồ sơ.
						</p>
					</div>
				</div>
			);
		default:
			return (
				<div className="flex items-start gap-3 rounded-2xl border border-[#dfe8df] bg-[#f7fbf7] p-4 text-[#2b4135]">
					<FileBadge className="mt-0.5 size-5 shrink-0 text-[#164027]" />
					<div>
						<p className="text-sm font-extrabold">Tải lên chứng chỉ dẫn đường</p>
						<p className="text-xs font-medium">
							Vui lòng tải ít nhất 1 tài liệu (chứng chỉ dẫn đường, thẻ hướng dẫn viên...) để Admin
							xác minh trước khi bạn nhận yêu cầu dẫn đoàn.
						</p>
					</div>
				</div>
			);
	}
}

export function PorterVerificationPage({ onLogout, onContinue }: PorterVerificationPageProps) {
	const state = usePorterVerification();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const { verification } = state;

	return (
		<div className="flex min-h-screen w-full items-start justify-center bg-[#f4f7f2] p-3 font-sans text-[#10221b] antialiased md:items-center md:p-6">
			<div className="w-full max-w-[740px] rounded-[28px] border border-[#e0ebe0] bg-white p-6 shadow-xl shadow-[#164027]/6 md:p-8">
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
							Xác minh chứng chỉ Porter
						</h1>
						<p className="mt-0.5 text-xs font-medium text-[#54655a]">
							Bước cuối cùng để hoàn tất đăng ký tài khoản Porter.
						</p>
					</div>
					{verification && (
						<StatusBadge tone={PORTER_VERIFICATION_STATUS_TONES[verification.status]}>
							{PORTER_VERIFICATION_STATUS_LABELS[verification.status]}
						</StatusBadge>
					)}
				</div>

				<RegisterStepper currentStep={4} steps={PORTER_REGISTER_STEPS} />
				<PorterQualificationGuidance />
				<div className="my-4 border-t border-[#f0f4f0]" />

				{state.isLoading ? (
					<div className="flex items-center justify-center gap-3 py-16 text-sm font-bold text-[#54655a]">
						<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải hồ sơ xác minh...
					</div>
				) : state.loadError || !verification ? (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5" />
							{state.loadError}
						</span>
						<Button type="button" size="sm" variant="outline" onClick={() => void state.reload()}>
							<RefreshCw className="mr-1 inline size-4" /> Thử lại
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						<StatusPanel verification={verification} onContinue={onContinue} />

						{state.actionError && (
							<div
								role="alert"
								className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700"
							>
								<AlertCircle className="size-4 shrink-0" />
								{state.actionError}
							</div>
						)}

						<section aria-label="Tài liệu đã tải lên" className="space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-extrabold">Tài liệu đã tải lên</h2>
								<span className="text-xs font-bold text-[#667a6d]">
									{state.documents.length}/{PORTER_VERIFICATION_MAX_DOCUMENTS}
								</span>
							</div>
							{state.documents.length === 0 ? (
								<p className="rounded-xl border border-dashed border-[#dfe8df] p-4 text-center text-xs font-medium text-[#667a6d]">
									Chưa có tài liệu nào.
								</p>
							) : (
								<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
									{state.documents.map((document) => (
										<DocumentPreview
											key={document.id}
											url={document.fileUrl}
											name={document.originalName}
											mimeType={document.mimeType}
											sizeBytes={document.sizeBytes}
											isRemoving={state.removingId === document.id}
											onRemove={
												state.isEditable ? () => void state.removeDocument(document.id) : undefined
											}
										/>
									))}
								</div>
							)}
						</section>

						{state.isEditable && state.remainingSlots > 0 && (
							<FileDropzone
								acceptMimeTypes={PORTER_VERIFICATION_MIME_TYPES}
								maxSizeBytes={PORTER_VERIFICATION_MAX_FILE_BYTES}
								multiple
								isUploading={state.isUploading}
								onFilesSelected={(files) => void state.uploadFiles(files)}
								onFilesRejected={(messages) => state.setActionError(messages.join(" "))}
								hint={`PDF, JPG, PNG hoặc WEBP · tối đa ${formatFileSize(
									PORTER_VERIFICATION_MAX_FILE_BYTES
								)}/file · còn ${state.remainingSlots} file`}
							/>
						)}

						{state.isEditable && (
							<div className="flex justify-end">
								<Button
									type="button"
									size="lg"
									disabled={state.documents.length === 0 || state.isUploading || state.isSubmitting}
									onClick={() => setConfirmOpen(true)}
								>
									<Send className="mr-2 inline size-4" />
									{verification.status === "rejected" ? "Nộp lại hồ sơ" : "Nộp hồ sơ để duyệt"}
								</Button>
							</div>
						)}
					</div>
				)}

				<div className="mt-6 border-t border-[#f0f4f0] pt-4">
					<LogoutActions onLogout={onLogout} />
				</div>
			</div>

			<ConfirmModal
				isOpen={confirmOpen}
				onClose={() => setConfirmOpen(false)}
				onConfirm={async () => {
					const submitted = await state.submit();
					if (submitted) setConfirmOpen(false);
				}}
				title="Nộp hồ sơ xác minh?"
				description={`Bạn sẽ không chỉnh sửa được ${state.documents.length} tài liệu đã tải lên cho tới khi Admin xử lý hồ sơ.`}
				confirmText="Nộp hồ sơ"
				variant="info"
				isLoading={state.isSubmitting}
			/>
		</div>
	);
}
