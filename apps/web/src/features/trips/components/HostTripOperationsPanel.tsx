import {
	AlertTriangle,
	CalendarClock,
	CheckCircle2,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { TripOperationError } from "../hooks/useTripOperations";
import { type TripDetails, formatTripStatus } from "../types";

export interface HostTripOperationsPanelProps {
	trip: TripDetails;
	isSubmitting: boolean;
	error: TripOperationError | null;
	successMessage: string | null;
	onReschedule: (input: {
		startsAt?: string;
		endsAt?: string;
	}) => Promise<TripDetails | null>;
	onCancel: (input: { reason: string }) => Promise<TripDetails | null>;
	onRetry: () => Promise<TripDetails | null>;
	onReset: () => void;
	onRefreshTrip: () => Promise<unknown> | unknown;
	onEditTrip?: () => void;
}

interface LocalValidation {
	startsAt?: string;
	endsAt?: string;
	reason?: string;
}

function toDateTimeLocalValue(value: string): string {
	const date = new Date(value);
	const offsetMs = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string {
	return new Date(value).toISOString();
}

function validateReschedule(
	currentStartsAt: string,
	currentEndsAt: string,
	startsAtValue: string,
	endsAtValue: string
): LocalValidation {
	const errors: LocalValidation = {};
	if (!startsAtValue && !endsAtValue) {
		errors.startsAt = "Cần nhập thời gian bắt đầu hoặc kết thúc mới.";
		return errors;
	}
	const currentStarts = new Date(currentStartsAt);
	const currentEnds = new Date(currentEndsAt);
	const startsAt = startsAtValue ? new Date(startsAtValue) : currentStarts;
	const endsAt = endsAtValue ? new Date(endsAtValue) : currentEnds;
	const minimumStartsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

	if (startsAt <= minimumStartsAt) {
		errors.startsAt = "Thời gian bắt đầu mới phải cách thời điểm hiện tại ít nhất 24 giờ.";
	}
	if (endsAt <= startsAt) {
		errors.endsAt = "Thời gian kết thúc phải sau thời gian bắt đầu.";
	}
	return errors;
}

function errorTone(kind: TripOperationError["kind"]): string {
	switch (kind) {
		case "validation":
			return "border-amber-200 bg-amber-50 text-amber-900";
		case "conflict":
			return "border-orange-200 bg-orange-50 text-orange-900";
		case "blocked":
			return "border-slate-200 bg-slate-50 text-slate-800";
		default:
			return "border-rose-200 bg-rose-50 text-rose-900";
	}
}

export function HostTripOperationsPanel({
	trip,
	isSubmitting,
	error,
	successMessage,
	onReschedule,
	onCancel,
	onRetry,
	onReset,
	onRefreshTrip,
	onEditTrip,
}: HostTripOperationsPanelProps) {
	const [startsAtValue, setStartsAtValue] = useState("");
	const [endsAtValue, setEndsAtValue] = useState("");
	const [cancelReason, setCancelReason] = useState("");
	const [activeMode, setActiveMode] = useState<"edit" | "reschedule" | "cancel">(
		trip.status === "draft" || trip.status === "pending_approval" ? "edit" : "reschedule"
	);
	const [localErrors, setLocalErrors] = useState<LocalValidation>({});
	const canEditBeforePublication = trip.status === "draft" || trip.status === "pending_approval";
	const isTripBlocked = trip.status === "completed" || trip.status === "cancelled";
	const isRescheduleBlocked = trip.status !== "published" || new Date(trip.startsAt) <= new Date();
	const defaultStartsAt = useMemo(() => toDateTimeLocalValue(trip.startsAt), [trip.startsAt]);
	const defaultEndsAt = useMemo(() => toDateTimeLocalValue(trip.endsAt), [trip.endsAt]);

	function validateDraftReschedule(nextStartsAtValue: string, nextEndsAtValue: string): void {
		setLocalErrors(
			validateReschedule(trip.startsAt, trip.endsAt, nextStartsAtValue, nextEndsAtValue)
		);
	}

	function handleStartsAtChange(value: string): void {
		setStartsAtValue(value);
		validateDraftReschedule(value, endsAtValue);
	}

	function handleEndsAtChange(value: string): void {
		setEndsAtValue(value);
		validateDraftReschedule(startsAtValue, value);
	}

	async function submitReschedule(): Promise<void> {
		const validation = validateReschedule(trip.startsAt, trip.endsAt, startsAtValue, endsAtValue);
		setLocalErrors(validation);
		if (Object.keys(validation).length > 0) return;
		const result = await onReschedule({
			startsAt: startsAtValue ? fromDateTimeLocalValue(startsAtValue) : undefined,
			endsAt: endsAtValue ? fromDateTimeLocalValue(endsAtValue) : undefined,
		});
		if (result) {
			setStartsAtValue("");
			setEndsAtValue("");
			await onRefreshTrip();
		}
	}

	async function submitCancel(): Promise<void> {
		const reason = cancelReason.trim();
		if (!reason) {
			setLocalErrors({ reason: "Cần nhập lý do huỷ chuyến đi." });
			return;
		}
		if (reason.length > 500) {
			setLocalErrors({ reason: "Lý do huỷ không vượt quá 500 ký tự." });
			return;
		}
		setLocalErrors({});
		const result = await onCancel({ reason });
		if (result) {
			setCancelReason("");
			await onRefreshTrip();
		}
	}

	return (
		<section
			data-testid="host-trip-operations-panel"
			className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
					<CalendarClock className="size-5" />
				</div>
				<div>
					<h3 className="text-base font-extrabold text-[#10221b]">Vận hành chuyến đi</h3>
					<p className="mt-1 text-xs text-[#667a6d]">
						Thay đổi lịch hoặc huỷ chuyến đi. Hệ thống sẽ kiểm tra lại trạng thái mới nhất trước khi
						ghi nhận.
					</p>
				</div>
			</div>

			{isTripBlocked ? (
				<div
					data-testid="host-trip-operations-blocked"
					className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
				>
					<p className="font-extrabold">Không còn thao tác khả dụng</p>
					<p className="mt-1">
						Chuyến đi ở trạng thái {formatTripStatus(trip.status)}, nên không thể đổi lịch hoặc huỷ.
					</p>
				</div>
			) : (
				<div className="mt-5 space-y-5">
					<div
						className={`grid gap-2 rounded-2xl bg-[#f4f7f2] p-1 ${
							canEditBeforePublication ? "grid-cols-3" : "grid-cols-2"
						}`}
					>
						{canEditBeforePublication && (
							<button
								type="button"
								onClick={() => {
									setActiveMode("edit");
									setLocalErrors({});
								}}
								className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
									activeMode === "edit"
										? "bg-white text-[#164027] shadow-sm"
										: "text-[#667a6d] hover:bg-white/70"
								}`}
							>
								Chỉnh sửa
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setActiveMode("reschedule");
								setLocalErrors({});
							}}
							className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
								activeMode === "reschedule"
									? "bg-white text-[#164027] shadow-sm"
									: "text-[#667a6d] hover:bg-white/70"
							}`}
						>
							Đổi lịch
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveMode("cancel");
								setLocalErrors({});
							}}
							className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
								activeMode === "cancel"
									? "bg-white text-rose-800 shadow-sm"
									: "text-[#667a6d] hover:bg-white/70"
							}`}
						>
							Huỷ chuyến
						</button>
					</div>

					{successMessage && (
						<output className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
							<CheckCircle2 className="size-4 shrink-0" />
							<div>
								<p className="font-extrabold">{successMessage}</p>
								<button
									type="button"
									onClick={onReset}
									className="mt-2 text-[11px] font-bold underline underline-offset-2"
								>
									Ẩn thông báo
								</button>
							</div>
						</output>
					)}

					{error && (
						<div role="alert" className={`rounded-2xl border p-4 text-xs ${errorTone(error.kind)}`}>
							<div className="flex items-start gap-2">
								<AlertTriangle className="size-4 shrink-0" />
								<div className="flex-1">
									<p className="font-extrabold">{error.message}</p>
									{error.kind === "conflict" && (
										<p className="mt-1">
											Dữ liệu có thể đã đổi. Tải lại chi tiết chuyến đi trước khi thử tiếp.
										</p>
									)}
									{error.canRetry && (
										<button
											type="button"
											onClick={onRetry}
											disabled={isSubmitting}
											className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold ring-1 ring-current/20 disabled:opacity-60"
										>
											<RefreshCw className="size-3.5" />
											<span>Thử lại</span>
										</button>
									)}
								</div>
							</div>
						</div>
					)}

					{activeMode === "edit" && (
						<div className="rounded-2xl border border-[#edf3ed] bg-[#fbfdfb] p-4">
							<p className="text-sm font-extrabold text-[#10221b]">Chỉnh sửa trước khi công bố</p>
							<p className="mt-2 text-xs leading-5 text-[#667a6d]">
								Chuyến đi ở trạng thái{" "}
								<span className="font-bold text-[#164027]">{formatTripStatus(trip.status)}</span>,
								nên thay đổi thông tin kế hoạch vẫn đi qua luồng chỉnh sửa và giữ nguyên trạng thái
								hiện tại.
							</p>
							<button
								type="button"
								onClick={onEditTrip}
								disabled={!onEditTrip || isSubmitting}
								className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
							>
								<span>Mở màn hình chỉnh sửa</span>
							</button>
						</div>
					)}

					{activeMode === "reschedule" && (
						<div className="rounded-2xl border border-[#edf3ed] p-4">
							<p className="text-sm font-extrabold text-[#10221b]">Đổi lịch</p>
							{isRescheduleBlocked ? (
								<p className="mt-2 text-xs text-[#667a6d]">
									Chỉ chuyến đi đã công bố và chưa bắt đầu mới có thể đổi lịch.
								</p>
							) : (
								<div className="mt-3 space-y-3">
									<label className="block text-xs font-bold text-[#55685a]">
										Bắt đầu mới
										<input
											type="datetime-local"
											value={startsAtValue}
											placeholder={defaultStartsAt}
											onChange={(event) => handleStartsAtChange(event.target.value)}
											className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
										/>
										<span className="mt-1 block text-[11px] font-medium text-[#8fa096]">
											Hiện tại: {defaultStartsAt.replace("T", " ")}
										</span>
									</label>
									{(localErrors.startsAt ?? error?.fieldErrors.startsAt) && (
										<p className="text-xs font-semibold text-rose-700">
											{localErrors.startsAt ?? error?.fieldErrors.startsAt}
										</p>
									)}
									<label className="block text-xs font-bold text-[#55685a]">
										Kết thúc mới
										<input
											type="datetime-local"
											value={endsAtValue}
											placeholder={defaultEndsAt}
											onChange={(event) => handleEndsAtChange(event.target.value)}
											className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
										/>
										<span className="mt-1 block text-[11px] font-medium text-[#8fa096]">
											Hiện tại: {defaultEndsAt.replace("T", " ")}
										</span>
									</label>
									{(localErrors.endsAt ?? error?.fieldErrors.endsAt) && (
										<p className="text-xs font-semibold text-rose-700">
											{localErrors.endsAt ?? error?.fieldErrors.endsAt}
										</p>
									)}
									<button
										type="button"
										onClick={submitReschedule}
										disabled={isSubmitting}
										className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
									>
										{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
										<span>Xác nhận đổi lịch</span>
									</button>
								</div>
							)}
						</div>
					)}

					{activeMode === "cancel" && (
						<div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
							<p className="flex items-center gap-2 text-sm font-extrabold text-rose-900">
								<XCircle className="size-4" />
								<span>Huỷ chuyến đi</span>
							</p>
							<textarea
								value={cancelReason}
								onChange={(event) => setCancelReason(event.target.value)}
								maxLength={500}
								rows={3}
								placeholder="Nhập lý do huỷ để ghi nhận lịch sử thao tác"
								className="mt-3 w-full resize-none rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm text-[#10221b] outline-none focus:border-rose-400"
							/>
							{(localErrors.reason ?? error?.fieldErrors.reason) && (
								<p className="mt-1 text-xs font-semibold text-rose-700">
									{localErrors.reason ?? error?.fieldErrors.reason}
								</p>
							)}
							<button
								type="button"
								onClick={submitCancel}
								disabled={isSubmitting}
								className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
								<span>Huỷ chuyến đi</span>
							</button>
						</div>
					)}
				</div>
			)}
		</section>
	);
}
