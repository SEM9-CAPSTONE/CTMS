import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import {
	mapCreatePorterRequestError,
	useCreatePorterRequest,
} from "../hooks/useCreatePorterRequest";
import type { IntendedPorterRole, PorterRequest } from "../types";

interface PorterRequestActionProps {
	tripId: string;
	porterId: string;
	role: IntendedPorterRole;
}

const PENDING_STATUS_LABEL = "Đang chờ phản hồi";

function formatExpiry(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));
}

export function PorterRequestAction({ tripId, porterId, role }: PorterRequestActionProps) {
	const [note, setNote] = useState("");
	const [confirmedRequest, setConfirmedRequest] = useState<PorterRequest | null>(null);
	const mutation = useCreatePorterRequest();
	const errorState = mutation.error ? mapCreatePorterRequestError(mutation.error) : null;
	const normalizedNote = useMemo(() => note.trim(), [note]);
	const isPendingRequest = confirmedRequest?.status === "pending";
	const isSubmitting = mutation.isPending;

	function submitRequest() {
		if (isSubmitting || isPendingRequest) return;
		mutation.mutate(
			{
				tripId,
				porterId,
				requestedRole: role,
				...(normalizedNote ? { note: normalizedNote } : {}),
			},
			{
				onSuccess: setConfirmedRequest,
			}
		);
	}

	return (
		<div className="mt-4 border-t border-[#dfe8df] pt-4">
			<label
				htmlFor={`porter-request-note-${porterId}`}
				className="text-xs font-bold text-[#10221b]"
			>
				Ghi chú yêu cầu
			</label>
			<textarea
				id={`porter-request-note-${porterId}`}
				value={note}
				onChange={(event) => setNote(event.target.value)}
				maxLength={500}
				disabled={isSubmitting || isPendingRequest}
				className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm text-[#10221b] outline-none transition focus:border-[#2d5a27] focus:ring-2 focus:ring-[#2d5a27]/15 disabled:bg-[#f5f7f5]"
				placeholder="Thêm vai trò, điểm cần lưu ý hoặc lời mời ngắn..."
			/>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
				<p className="text-[11px] font-semibold text-[#667a6d]">{note.length}/500</p>
				<Button
					size="sm"
					className="gap-2"
					disabled={isSubmitting || isPendingRequest}
					onClick={submitRequest}
				>
					{isSubmitting ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					) : (
						<Send className="size-3.5" aria-hidden="true" />
					)}
					{isSubmitting ? "Đang gửi" : isPendingRequest ? "Đã gửi yêu cầu" : "Gửi yêu cầu"}
				</Button>
			</div>

			{isPendingRequest && (
				<output
					data-testid={`porter-request-state-${porterId}`}
					className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
				>
					<p className="flex items-center gap-2 font-extrabold">
						<CheckCircle2 className="size-4" aria-hidden="true" />
						{PENDING_STATUS_LABEL}
					</p>
					<p className="mt-1 font-semibold">Hết hạn: {formatExpiry(confirmedRequest.expiresAt)}</p>
				</output>
			)}

			{errorState && !isPendingRequest && (
				<div
					role="alert"
					data-error-kind={errorState.kind}
					className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
				>
					<p className="flex items-start gap-2 font-bold">
						<XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						<span>{errorState.message}</span>
					</p>
					{errorState.canRetry && (
						<Button
							size="sm"
							variant="outline"
							className="mt-2"
							disabled={isSubmitting}
							onClick={submitRequest}
						>
							Thử lại
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
