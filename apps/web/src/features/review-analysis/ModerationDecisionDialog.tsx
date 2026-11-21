import { AlertCircle, Eye, Info, Loader2, X } from "lucide-react";
import { useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { StatusBadge } from "../../shared/components/StatusBadge";
import { toast } from "../../shared/components/Toast";
import { QuarantinedImageModal } from "./QuarantinedImageModal";
import {
	adminOverrideMessage,
	buttonClass,
	conflict409Message,
	dangerButtonClass,
	moderationFlagLabels,
	secondaryButtonClass,
} from "./constants";
import { analysisService } from "./service";
import type {
	HostModerationDecisionAction,
	HostReviewModerationDetail,
	ModerationFlagType,
	ModerationQueueItem,
} from "./types";

interface ModerationDecisionDialogProps {
	item: ModerationQueueItem | HostReviewModerationDetail;
	onClose: () => void;
	onSuccess: () => void;
}

const APPROVED_HIDE_REASONS: ModerationFlagType[] = [
	"profanity_or_insult",
	"personal_data_leak",
	"spam_or_irrelevant",
	"harassment",
	"inappropriate_image",
];

function isModerationDetail(
	item: ModerationQueueItem | HostReviewModerationDetail
): item is HostReviewModerationDetail {
	return "moderationVerificationStatus" in item;
}

export function ModerationDecisionDialog({
	item,
	onClose,
	onSuccess,
}: ModerationDecisionDialogProps) {
	const isCurrentlyHidden = item.moderationStatus === "hidden";
	const detail = isModerationDetail(item) ? item : null;
	const isUnverified = detail?.moderationVerificationStatus === "unverified";
	const isAiHidden = isCurrentlyHidden && detail?.hiddenSource === "ai";
	const isAdminActioned = detail?.adminActioned === true;

	const defaultReason: ModerationFlagType =
		item.activeFlags[0]?.flagType || item.hiddenReason || "profanity_or_insult";

	const maxFlagConfidence = item.activeFlags.reduce<number>((max, flag) => {
		if (flag.detectionSource === "rule" || flag.confidence === null) {
			return 1;
		}
		return Math.max(max, flag.confidence);
	}, 0);

	const canHideReview =
		isCurrentlyHidden || isUnverified || item.activeFlags.length === 0 || maxFlagConfidence >= 0.5;

	const [decision, setDecision] = useState<HostModerationDecisionAction>(
		isCurrentlyHidden ? "restore" : canHideReview ? "hide" : "keep"
	);
	const [reason, setReason] = useState<ModerationFlagType>(defaultReason);
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [overrideNotice, setOverrideNotice] = useState<string | null>(null);
	const [inspectImageIndex, setInspectImageIndex] = useState<number | null>(null);

	const selectableReasons =
		isUnverified || item.activeFlags.length === 0
			? APPROVED_HIDE_REASONS
			: Array.from(new Set(item.activeFlags.map((flag) => flag.flagType)));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;

		setIsSubmitting(true);
		setErrorMessage(null);
		setOverrideNotice(null);

		try {
			const res = await analysisService.recordDecision(item.reviewId, {
				expectedRevision: item.sourceRevision,
				decision,
				reason: decision === "hide" ? reason : undefined,
				note: note.trim() || undefined,
			});

			if (res.adminActionedOverride) {
				setOverrideNotice(adminOverrideMessage);
				toast.warning(adminOverrideMessage);
				setTimeout(() => {
					onSuccess();
				}, 2200);
			} else {
				const successMessage =
					decision === "hide"
						? "Đã ẩn đánh giá khỏi trang công khai."
						: decision === "keep"
							? "Đã xác nhận giữ lại đánh giá."
							: "Đã khôi phục hiển thị đánh giá.";
				toast.success(successMessage);
				onSuccess();
			}
		} catch (err: unknown) {
			let msg = "Lỗi kết nối. Vui lòng kiểm tra lại mạng.";
			if (err instanceof HttpError) {
				if (err.status === 409) {
					msg = conflict409Message;
				} else if (err.status === 403) {
					msg = "Bạn không có quyền xử lý kiểm duyệt cho chuyến đi này.";
				} else {
					msg = "Không thể ghi nhận quyết định lúc này. Vui lòng thử lại.";
				}
			}
			setErrorMessage(msg);
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			{/* biome-ignore lint/a11y/useSemanticElements: custom accessible dialog backdrop */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="decision-dialog-title"
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
			>
				<div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
					<header className="flex items-center justify-between border-b border-[#dfe8df] px-6 py-4">
						<div>
							<h2 id="decision-dialog-title" className="text-base font-bold text-[#10221b]">
								{isCurrentlyHidden ? "Xem xét đánh giá đang ẩn" : "Xem xét đánh giá"}
							</h2>
							<p className="mt-0.5 text-xs text-[#667a6d]">
								{item.tripTitle}
								{detail?.reviewerName ? ` • ${detail.reviewerName}` : ""}
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							aria-label="Đóng"
							className="rounded-lg p-1.5 text-[#53674d] transition-colors hover:bg-[#f0f5ed] hover:text-[#10221b] disabled:opacity-40"
						>
							<X className="size-5" />
						</button>
					</header>

					<form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
						<div className="mb-4 flex flex-wrap items-center gap-2">
							{isAiHidden && <StatusBadge tone="danger">Hệ thống đã tự động ẩn</StatusBadge>}
							{isCurrentlyHidden && !isAiHidden && (
								<StatusBadge tone="warning">Đánh giá đang ẩn</StatusBadge>
							)}
							{!isCurrentlyHidden && isUnverified && (
								<StatusBadge tone="warning">Chưa xác minh được</StatusBadge>
							)}
							{!isCurrentlyHidden && !isUnverified && (
								<StatusBadge tone="info">Đang hiển thị • Chờ xem xét</StatusBadge>
							)}
							{isAdminActioned && (
								<StatusBadge tone="danger">Quản trị viên đã xử lý vi phạm</StatusBadge>
							)}
						</div>

						{isUnverified && (
							<div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
								<Info className="mt-0.5 size-4 shrink-0 text-amber-700" />
								<p>
									Hệ thống kiểm duyệt tự động chưa thể xác minh nội dung này. Bạn có thể trực tiếp
									giữ lại hoặc ẩn đánh giá theo tiêu chuẩn cộng đồng.
								</p>
							</div>
						)}

						{isAdminActioned && (
							<div className="mb-4 flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-xs leading-relaxed text-rose-900">
								<AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-700" />
								<p>
									Quản trị viên đã xử lý báo cáo vi phạm cho đánh giá này. Việc khôi phục từ chủ
									chuyến sẽ được ghi nhận nhưng đánh giá vẫn giữ trạng thái ẩn công khai.
								</p>
							</div>
						)}

						{overrideNotice && (
							// biome-ignore lint/a11y/useSemanticElements: accessible status callout
							<div
								role="status"
								className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900"
							>
								<Info className="mt-0.5 size-5 shrink-0 text-amber-700" />
								<div>
									<p className="font-semibold">Thông báo trạng thái</p>
									<p className="mt-1 text-xs">{overrideNotice}</p>
								</div>
							</div>
						)}

						{errorMessage && (
							<div
								role="alert"
								className="mb-4 flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-900"
							>
								<AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
								<div>
									<p className="font-semibold">Không thể hoàn tất</p>
									<p className="mt-1 text-xs">{errorMessage}</p>
								</div>
							</div>
						)}

						<div className="mb-4 border-b border-[#e8efe8] pb-4 text-sm text-[#10221b]">
							<p className="leading-relaxed">
								{item.comment || "Người tham gia không để lại nhận xét văn bản."}
							</p>
							<p className="mt-2 text-xs text-[#667a6d]">
								Đánh giá {item.rating}/5 sao • Phiên bản #{item.sourceRevision}
							</p>
							{item.images.length > 0 && item.imageStorageState === "quarantined" && (
								<div className="mt-3 flex flex-wrap gap-2">
									{item.images.map((imageUrl, idx) => (
										<button
											key={imageUrl}
											type="button"
											onClick={() => setInspectImageIndex(idx)}
											className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] bg-[#f6f9f6] px-3 py-1.5 text-xs font-medium text-[#164027] transition-colors hover:bg-[#eaf2ea]"
										>
											<Eye className="size-3.5" />
											<span>Xem ảnh cách ly #{idx + 1}</span>
										</button>
									))}
								</div>
							)}
						</div>

						{item.activeFlags.length > 0 && (
							<div className="mb-4 border-b border-[#e8efe8] pb-4">
								<p className="mb-2 text-xs font-semibold tracking-wide text-[#53674d]">
									Dấu hiệu vi phạm phát hiện ({item.activeFlags.length})
								</p>
								<ul className="space-y-2">
									{item.activeFlags.map((flag) => (
										<li key={flag.id} className="rounded-xl bg-[#f9faf8] px-3.5 py-2.5 text-xs">
											<div className="flex items-center justify-between gap-2">
												<span className="font-semibold text-[#10221b]">
													{moderationFlagLabels[flag.flagType] ?? flag.flagType}
												</span>
												<span className="font-medium text-[#53674d]">
													{flag.confidence !== null
														? `Độ tin cậy ${Math.round(flag.confidence * 100)}%`
														: "Quy tắc tự động"}
												</span>
											</div>
											{flag.evidence && <p className="mt-1 text-[#53674d]">{flag.evidence}</p>}
											{flag.quote && (
												<p className="mt-1 italic text-[#667a6d]">&ldquo;{flag.quote}&rdquo;</p>
											)}
										</li>
									))}
								</ul>
							</div>
						)}

						<fieldset className="mb-4">
							<legend className="mb-2 text-xs font-semibold tracking-wide text-[#53674d]">
								Quyết định của chủ chuyến
							</legend>
							<div className="space-y-2">
								{!isCurrentlyHidden && (
									<>
										<label
											className={`flex items-start gap-3 rounded-xl border p-3 transition ${
												!canHideReview
													? "cursor-not-allowed border-[#e5eae4] bg-[#f8faf7] opacity-60"
													: decision === "hide"
														? "cursor-pointer border-rose-600 bg-rose-50/60 text-rose-950"
														: "cursor-pointer border-[#dfe8df] bg-white hover:bg-[#f9faf8]"
											}`}
										>
											<input
												type="radio"
												name="decision"
												value="hide"
												disabled={!canHideReview}
												checked={decision === "hide"}
												onChange={() => setDecision("hide")}
												className="mt-1 size-4 accent-rose-700"
											/>
											<div className="min-w-0">
												<span className="text-sm font-semibold text-rose-900">Ẩn đánh giá</span>
												<p className="text-xs text-[#667a6d]">
													{canHideReview
														? "Ẩn đánh giá và cách ly ảnh đính kèm khỏi trang chuyến đi công khai."
														: "Độ tin cậy vi phạm dưới 50% — theo quy định hệ thống, đánh giá này không được ẩn."}
												</p>
											</div>
										</label>

										<label
											className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
												decision === "keep"
													? "border-[#164027] bg-emerald-50/60 text-[#10221b]"
													: "border-[#dfe8df] bg-white hover:bg-[#f9faf8]"
											}`}
										>
											<input
												type="radio"
												name="decision"
												value="keep"
												checked={decision === "keep"}
												onChange={() => setDecision("keep")}
												className="mt-1 size-4 accent-[#164027]"
											/>
											<div className="min-w-0">
												<span className="text-sm font-semibold text-[#164027]">
													Giữ lại đánh giá
												</span>
												<p className="text-xs text-[#667a6d]">
													Bác bỏ cảnh báo vi phạm; giữ đánh giá hiển thị công khai bình thường.
												</p>
											</div>
										</label>
									</>
								)}

								{isCurrentlyHidden && (
									<label
										className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
											decision === "restore"
												? "border-[#164027] bg-emerald-50/60 text-[#10221b]"
												: "border-[#dfe8df] bg-white"
										}`}
									>
										<input
											type="radio"
											name="decision"
											value="restore"
											checked={decision === "restore"}
											onChange={() => setDecision("restore")}
											className="mt-1 size-4 accent-[#164027]"
										/>
										<div className="min-w-0">
											<span className="text-sm font-semibold text-[#164027]">
												Khôi phục hiển thị
											</span>
											<p className="text-xs text-[#667a6d]">
												Đưa đánh giá trở lại hiển thị công khai và phục hồi tệp ảnh liên quan.
											</p>
										</div>
									</label>
								)}
							</div>
						</fieldset>

						{decision === "hide" && (
							<div className="mb-4">
								<label
									htmlFor="moderation-reason-select"
									className="mb-1 block text-xs font-semibold tracking-wide text-[#53674d]"
								>
									Lý do vi phạm <span className="text-rose-600">*</span>
								</label>
								<select
									id="moderation-reason-select"
									value={reason}
									onChange={(e) => setReason(e.target.value as ModerationFlagType)}
									className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#10221b] focus:border-[#164027] focus:outline-hidden"
								>
									{selectableReasons.map((key) => (
										<option key={key} value={key}>
											{moderationFlagLabels[key] ?? key}
										</option>
									))}
								</select>
							</div>
						)}

						<div className="mb-4">
							<label
								htmlFor="moderation-note"
								className="mb-1 block text-xs font-semibold tracking-wide text-[#53674d]"
							>
								Ghi chú
							</label>
							<textarea
								id="moderation-note"
								rows={3}
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="Nhập ghi chú đối chiếu để lưu lịch sử xử lý…"
								className="w-full rounded-xl border border-[#dfe8df] p-3 text-sm text-[#10221b] focus:border-[#164027] focus:outline-hidden"
							/>
						</div>

						<footer className="mt-auto flex justify-end gap-3 border-t border-[#dfe8df] pt-4">
							<button
								type="button"
								onClick={onClose}
								disabled={isSubmitting}
								className={secondaryButtonClass}
							>
								Hủy
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className={decision === "hide" ? dangerButtonClass : buttonClass}
							>
								{isSubmitting && <Loader2 className="size-4 animate-spin" />}
								<span>
									{decision === "hide"
										? "Xác nhận ẩn đánh giá"
										: decision === "keep"
											? "Xác nhận giữ lại"
											: "Xác nhận khôi phục"}
								</span>
							</button>
						</footer>
					</form>
				</div>
			</div>

			{inspectImageIndex !== null && (
				<QuarantinedImageModal
					reviewId={item.reviewId}
					imageIndex={inspectImageIndex}
					onClose={() => setInspectImageIndex(null)}
				/>
			)}
		</>
	);
}
