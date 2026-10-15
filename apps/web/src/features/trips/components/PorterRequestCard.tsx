import { CheckCircle2, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import type { PorterRequest, PorterRequestStatus } from "../types";
import { formatDateRange } from "./TripCard";

const statusLabels: Record<PorterRequestStatus, string> = {
	pending: "Đang chờ phản hồi",
	accepted: "Đã chấp nhận",
	declined: "Đã từ chối",
	cancelled: "Đã hủy",
	expired: "Đã hết hạn",
};

const statusClasses: Record<PorterRequestStatus, string> = {
	pending: "bg-amber-50 text-amber-800 border-amber-200",
	accepted: "bg-emerald-50 text-emerald-800 border-emerald-200",
	declined: "bg-slate-50 text-slate-700 border-slate-200",
	cancelled: "bg-rose-50 text-rose-800 border-rose-200",
	expired: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

function formatDateTime(value: string) {
	return new Date(value).toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export interface PorterRequestCardProps {
	request: PorterRequest;
	onAccept?: (request: PorterRequest) => void;
	onDecline?: (request: PorterRequest) => void;
	onCancel?: (request: PorterRequest) => void;
	isSubmitting?: boolean;
	mode: "porter" | "host";
}

export function PorterRequestCard({
	request,
	onAccept,
	onDecline,
	onCancel,
	isSubmitting = false,
	mode,
}: PorterRequestCardProps) {
	const trip = request.trip;
	const isPending = request.status === "pending";

	return (
		<li className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-extrabold text-[#10221b]">
							{trip?.title ?? "Yêu cầu Porter"}
						</h3>
						<span
							className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusClasses[request.status]}`}
						>
							{statusLabels[request.status]}
						</span>
					</div>
					{trip && (
						<p className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#667a6d]">
							<Clock className="size-4" />
							{formatDateRange(trip.startsAt, trip.endsAt)}
						</p>
					)}
					{trip?.meetingAt && (
						<p className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#667a6d]">
							<MapPin className="size-4" />
							Tập trung: {formatDateTime(trip.meetingAt)}
						</p>
					)}
					<div className="mt-2 space-y-1 text-xs font-semibold text-[#667a6d]">
						<p>
							Vai trò: {request.requestedRole === "lead" ? "Trưởng nhóm Porter" : "Porter hỗ trợ"}
						</p>
						{trip && <p>Kết thúc: {formatDateTime(trip.endsAt)}</p>}
					</div>
					{request.note && <p className="mt-3 text-sm text-[#425048]">{request.note}</p>}
				</div>

				<div className="flex shrink-0 flex-wrap gap-2">
					{mode === "porter" && isPending && (
						<>
							<Button
								size="sm"
								onClick={() => onAccept?.(request)}
								disabled={isSubmitting}
								className="gap-2"
							>
								{isSubmitting ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<CheckCircle2 className="size-4" />
								)}
								Chấp nhận
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => onDecline?.(request)}
								disabled={isSubmitting}
								className="gap-2"
							>
								<XCircle className="size-4" />
								Từ chối
							</Button>
						</>
					)}
					{mode === "host" && isPending && (
						<Button
							size="sm"
							variant="outline"
							onClick={() => onCancel?.(request)}
							disabled={isSubmitting}
						>
							Hủy yêu cầu
						</Button>
					)}
				</div>
			</div>
		</li>
	);
}
