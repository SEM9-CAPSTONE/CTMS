import { AlertCircle, Info, Loader2, X } from "lucide-react";
import { useState } from "react";
import { HttpError } from "../../core/api/httpClient";
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
	ModerationFlagType,
	ModerationQueueItem,
} from "./types";

interface ModerationDecisionDialogProps {
	item: ModerationQueueItem;
	onClose: () => void;
	onSuccess: () => void;
}

export function ModerationDecisionDialog({
	item,
	onClose,
	onSuccess,
}: ModerationDecisionDialogProps) {
	const isCurrentlyHidden = item.moderationStatus === "hidden";

	const defaultReason: ModerationFlagType = item.activeFlags[0]?.flagType || "profanity_or_insult";

	const [decision, setDecision] = useState<HostModerationDecisionAction>(
		isCurrentlyHidden ? "restore" : "hide"
	);
	const [reason, setReason] = useState<ModerationFlagType>(defaultReason);
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [overrideNotice, setOverrideNotice] = useState<string | null>(null);

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
				setTimeout(() => {
					onSuccess();
				}, 2200);
			} else {
				onSuccess();
			}
		} catch (err: unknown) {
			if (err instanceof HttpError) {
				if (err.status === 409) {
					setErrorMessage(conflict409Message);
				} else if (err.status === 403) {
					setErrorMessage("Bạn không có quyền xử lý kiểm duyệt cho chuyến đi này.");
				} else {
					setErrorMessage(err.message || "Có lỗi xảy ra khi ghi nhận quyết định.");
				}
			} else {
				setErrorMessage("Lỗi kết nối. Vui lòng kiểm tra lại mạng.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: custom accessible dialog backdrop
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="decision-dialog-title"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		>
			<div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
				<header className="flex items-center justify-between border-b border-[#dfe8df] px-5 py-4">
					<h2 id="decision-dialog-title" className="text-base font-bold text-[#10221b]">
						{isCurrentlyHidden ? "Xử lý đánh giá đang ẩn" : "Quyết định kiểm duyệt đánh giá"}
					</h2>
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						aria-label="Đóng"
						className="rounded-lg p-1.5 text-[#53674d] hover:bg-[#f0f5ed] hover:text-[#10221b] disabled:opacity-40"
					>
						<X className="size-5" />
					</button>
				</header>

				<form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-5">
					{overrideNotice && (
						// biome-ignore lint/a11y/useSemanticElements: accessible status callout
						<div
							role="status"
							className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
						>
							<Info className="mt-0.5 size-5 shrink-0 text-amber-700" />
							<div>
								<p className="font-semibold">Thông báo trạng thái</p>
								<p className="mt-1">{overrideNotice}</p>
							</div>
						</div>
					)}

					{errorMessage && (
						<div
							role="alert"
							className="mb-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
						>
							<AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
							<div>
								<p className="font-semibold">Không thể hoàn tất</p>
								<p className="mt-1">{errorMessage}</p>
							</div>
						</div>
					)}

					<div className="mb-4 rounded-xl border border-[#dfe8df] bg-[#f9faf8] p-3 text-xs text-[#53674d]">
						<p className="font-semibold text-[#10221b]">{item.tripTitle}</p>
						<p className="mt-1 line-clamp-2 italic text-[#667a6d]">
							&ldquo;{item.comment || "Không có nội dung văn bản"}&rdquo;
						</p>
						<p className="mt-2 text-[11px] text-[#728070]">
							Đánh giá {item.rating}/5 sao • Phiên bản #{item.sourceRevision}
						</p>
					</div>

					<fieldset className="mb-4">
						<legend className="mb-2 text-xs font-bold uppercase tracking-wider text-[#53674d]">
							Hành động của Chủ chuyến
						</legend>
						<div className="space-y-2">
							{!isCurrentlyHidden && (
								<>
									<label
										className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
											decision === "hide"
												? "border-rose-600 bg-rose-50/60 text-rose-950"
												: "border-[#dfe8df] bg-white hover:bg-[#f9faf8]"
										}`}
									>
										<input
											type="radio"
											name="decision"
											value="hide"
											checked={decision === "hide"}
											onChange={() => setDecision("hide")}
											className="mt-1 size-4 accent-rose-700"
										/>
										<div className="min-w-0">
											<span className="text-sm font-semibold text-rose-900">Ẩn đánh giá</span>
											<p className="text-xs text-[#667a6d]">
												Ẩn đánh giá và ảnh đính kèm khỏi trang chuyến đi công khai.
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
											<span className="text-sm font-semibold text-[#164027]">Giữ lại đánh giá</span>
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
										<span className="text-sm font-semibold text-[#164027]">Khôi phục hiển thị</span>
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
								className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#53674d]"
							>
								Lý do vi phạm <span className="text-rose-600">*</span>
							</label>
							<select
								id="moderation-reason-select"
								value={reason}
								onChange={(e) => setReason(e.target.value as ModerationFlagType)}
								className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#10221b] focus:border-[#164027] focus:outline-hidden"
							>
								{Object.entries(moderationFlagLabels).map(([key, label]) => (
									<option key={key} value={key}>
										{label}
									</option>
								))}
							</select>
						</div>
					)}

					<div className="mb-4">
						<label
							htmlFor="moderation-note"
							className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#53674d]"
						>
							Ghi chú xử lý (tùy chọn)
						</label>
						<textarea
							id="moderation-note"
							rows={3}
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Nhập ghi chú đối chiếu để lưu vết kiểm duyệt…"
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
	);
}
