import { FileText, Loader2, Paperclip, ShieldCheck, Trash2 } from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Modal } from "../../../shared/components/Modal";
import {
	useRequestWeatherPenaltyWaiver,
	useUploadWeatherPenaltyEvidence,
} from "../hooks/useWeatherPenalties";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { UploadedEvidence, WeatherPenalty } from "../types";
import {
	EVIDENCE_MIME_TYPES,
	MAX_EVIDENCE_BYTES,
	MAX_EVIDENCE_FILES,
	formatPenaltyDateTime,
	weatherPenaltyErrorMessage,
} from "../utils/weather-penalty-labels";

interface EvidenceItem extends UploadedEvidence {
	name: string;
}

export interface WeatherPenaltyWaiverModalProps {
	penalty: WeatherPenalty;
	onClose: () => void;
	onSubmitted?: () => void;
	service?: typeof weatherPenaltiesService;
}

/** Policy §6: force-majeure waiver request with a reason and 1–5 evidence files (image or PDF). */
export function WeatherPenaltyWaiverModal({
	penalty,
	onClose,
	onSubmitted,
	service,
}: WeatherPenaltyWaiverModalProps) {
	const reasonId = useId();
	const fileId = useId();
	const [reason, setReason] = useState("");
	const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const upload = useUploadWeatherPenaltyEvidence(service);
	const request = useRequestWeatherPenaltyWaiver(service);
	const busy = upload.isPending || request.isPending;

	async function addFiles(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		event.target.value = "";
		setError(null);
		if (evidence.length + files.length > MAX_EVIDENCE_FILES) {
			setError(`Chỉ được đính kèm tối đa ${MAX_EVIDENCE_FILES} file.`);
			return;
		}
		for (const file of files) {
			if (!EVIDENCE_MIME_TYPES.includes(file.type)) {
				setError("File phải là ảnh JPG, PNG, WEBP hoặc PDF.");
				return;
			}
			if (file.size > MAX_EVIDENCE_BYTES) {
				setError("Mỗi file tối đa 5MB.");
				return;
			}
		}
		for (const file of files) {
			try {
				const stored = await upload.mutateAsync(file);
				setEvidence((current) => [...current, { ...stored, name: file.name }]);
			} catch (uploadError) {
				setError(weatherPenaltyErrorMessage(uploadError));
				return;
			}
		}
	}

	function validate(): boolean {
		if (!reason.trim()) {
			setError("Vui lòng nhập lý do xin miễn phạt.");
			return false;
		}
		if (evidence.length === 0) {
			setError("Vui lòng đính kèm ít nhất 1 file bằng chứng.");
			return false;
		}
		setError(null);
		return true;
	}

	async function submit() {
		try {
			await request.mutateAsync({
				penaltyId: penalty.id,
				input: { reason: reason.trim(), evidenceUrls: evidence.map((item) => item.url) },
			});
			setConfirming(false);
			onSubmitted?.();
			onClose();
		} catch (submitError) {
			setConfirming(false);
			setError(weatherPenaltyErrorMessage(submitError));
		}
	}

	return (
		<Modal
			isOpen
			onClose={onClose}
			title="Xin miễn phạt thời tiết"
			icon={<ShieldCheck className="size-5" />}
			description={penalty.tripTitle}
			size="lg"
			isCloseDisabled={busy}
			closeLabel="Đóng"
		>
			<div className="space-y-4 text-sm text-[#10221b]" data-testid="weather-penalty-waiver-modal">
				<p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
					Chỉ dùng cho trường hợp bất khả kháng (ốm, tai nạn…). Mỗi khoản phạt chỉ được gửi 1 lần,
					hạn gửi đến {formatPenaltyDateTime(penalty.waiverDeadline)}. Admin xem xét trong 5 ngày
					làm việc.
				</p>
				<div>
					<label htmlFor={reasonId} className="text-xs font-extrabold">
						Lý do (bắt buộc)
					</label>
					<textarea
						id={reasonId}
						value={reason}
						maxLength={1000}
						rows={4}
						onChange={(event) => setReason(event.target.value)}
						className="mt-1 w-full rounded-2xl border border-[#dfe8df] p-3 text-sm outline-none focus:border-[#164027]"
						placeholder="Ví dụ: Tôi nhập viện cấp cứu từ tối 14/11 nên không thể trả lời."
					/>
				</div>
				<div>
					<p className="text-xs font-extrabold">
						Bằng chứng ({evidence.length}/{MAX_EVIDENCE_FILES}): ảnh JPG, PNG, WEBP hoặc PDF, tối đa
						5MB mỗi file
					</p>
					{evidence.length > 0 && (
						<ul className="mt-2 space-y-1.5">
							{evidence.map((item) => (
								<li
									key={item.url}
									className="flex items-center justify-between gap-2 rounded-xl border border-[#edf3ed] bg-[#fbfdfb] px-3 py-2 text-xs"
								>
									<span className="flex min-w-0 items-center gap-2">
										<FileText className="size-4 shrink-0 text-[#164027]" />
										<span className="truncate">{item.name}</span>
									</span>
									<button
										type="button"
										onClick={() =>
											setEvidence((current) => current.filter((entry) => entry.url !== item.url))
										}
										disabled={busy}
										aria-label={`Bỏ file ${item.name}`}
										className="rounded-lg p-1 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
									>
										<Trash2 className="size-4" />
									</button>
								</li>
							))}
						</ul>
					)}
					{evidence.length < MAX_EVIDENCE_FILES && (
						<label
							htmlFor={fileId}
							className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#9fb5a4] px-4 py-2 text-xs font-bold text-[#164027] hover:bg-[#f6f9f6]"
						>
							{upload.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Paperclip className="size-4" />
							)}
							{upload.isPending ? "Đang tải lên..." : "Chọn file bằng chứng"}
							<input
								id={fileId}
								type="file"
								multiple
								accept={EVIDENCE_MIME_TYPES.join(",")}
								onChange={(event) => void addFiles(event)}
								disabled={busy}
								className="sr-only"
								data-testid="weather-penalty-evidence-input"
							/>
						</label>
					)}
				</div>
				{error && (
					<p
						role="alert"
						className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
					>
						{error}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="rounded-xl bg-[#edf3ed] px-4 py-2 text-xs font-bold text-[#164027] hover:bg-[#dfeade] disabled:opacity-50"
					>
						Huỷ
					</button>
					<button
						type="button"
						onClick={() => validate() && setConfirming(true)}
						disabled={busy}
						className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d2617] disabled:opacity-50"
					>
						Gửi yêu cầu miễn phạt
					</button>
				</div>
			</div>
			<ConfirmModal
				isOpen={confirming}
				onClose={() => setConfirming(false)}
				onConfirm={submit}
				title="Gửi yêu cầu miễn phạt?"
				description="Mỗi khoản phạt chỉ được gửi yêu cầu 1 lần. Sau khi gửi bạn không sửa được lý do hay bằng chứng."
				confirmText="Xác nhận"
				cancelText="Quay lại"
				variant="warning"
				isLoading={request.isPending}
			/>
		</Modal>
	);
}
