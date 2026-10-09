import { Check, Clock3, Copy, Loader2, Minus, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
	formatBookingStatus,
	formatPaymentStatus,
} from "../../booking-details/utils/booking-details-formatters";
import { bookTripSchema } from "../schema/book-trip.schema";
import type { BookTripResponse, TripDetails } from "../types";
import { BookingConflictDialog } from "./BookingConflictDialog";
import { formatVND } from "./TripCard";

function formatBookingDateTime(isoString: string): string {
	return new Date(isoString).toLocaleDateString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

// const bookingStatusLabels: Record<BookTripResponse["status"], string> = {
//   pending_payment: "Chờ thanh toán",
//   pending_reconfirmation: "Chờ xác nhận lại",
//   confirmed: "Đã xác nhận",
//   cancelled: "Đã huỷ",
//   expired: "Đã hết hạn",
//   completed: "Đã hoàn thành",
// };

// const paymentStatusLabels: Record<BookTripResponse["paymentStatus"], string> = {
//   not_required: "Không cần thanh toán",
//   unpaid: "Chưa thanh toán",
//   paid: "Đã thanh toán",
// };

export type BookingAccess = "anonymous" | "camper" | "non-camper";

export interface BookingPanelProps {
	trip: Pick<
		TripDetails,
		"id" | "remainingSeats" | "isBookable" | "bookingDeadline" | "pricePerPerson"
	>;
	bookingAccess?: BookingAccess;
	booking?: BookTripResponse | null;
	isBooking?: boolean;
	bookingError?: string | null;
	fieldErrors?: Record<string, string>;
	isConflict?: boolean;
	canRetry?: boolean;
	equipmentRentalTotal?: number;
	equipmentRentalCount?: number;
	onBook?: (tripId: string, numPeople: number) => void | Promise<void>;
	onRetry?: () => unknown;
	onReset?: () => void;
	onSignIn?: () => void;
	onConflictDismiss?: () => void;
	onConflictReload?: () => void;
	onViewBookingDetails?: (bookingId: string) => void;
}

function getBookingStatusBadge(status: string): string {
	switch (status) {
		case "confirmed":
			return "bg-emerald-100 text-emerald-800 border-emerald-300";
		case "pending_payment":
			return "bg-amber-100 text-amber-900 border-amber-300";
		case "cancelled":
		case "expired":
			return "bg-rose-100 text-rose-800 border-rose-300";
		case "completed":
			return "bg-blue-100 text-blue-800 border-blue-300";
		default:
			return "bg-slate-100 text-slate-800 border-slate-300";
	}
}

function getPaymentStatusBadge(status: string): string {
	switch (status) {
		case "paid":
			return "bg-emerald-100 text-emerald-800 border-emerald-300";
		case "unpaid":
			return "bg-amber-100 text-amber-900 border-amber-300";
		case "not_required":
			return "bg-sky-100 text-sky-800 border-sky-300";
		default:
			return "bg-slate-100 text-slate-800 border-slate-300";
	}
}

function BookingResult({
	booking,
	onReset,
	onViewBookingDetails,
}: {
	booking: BookTripResponse;
	onReset?: () => void;
	onViewBookingDetails?: (bookingId: string) => void;
}) {
	const isFreeConfirmed =
		booking.status === "confirmed" && booking.paymentStatus === "not_required";
	const isHoldOverdue = Boolean(
		booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() < Date.now()
	);
	const isExpired =
		booking.status === "expired" || (booking.status === "pending_payment" && isHoldOverdue);
	const isPendingPayment =
		booking.status === "pending_payment" && booking.paymentStatus === "unpaid" && !isExpired;
	const [copied, setCopied] = useState(false);

	const handleCopyId = async () => {
		try {
			await navigator.clipboard.writeText(booking.id);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// ignore clipboard write failure in test/unsupported environments
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: The live status contains structured Booking details that are not valid phrasing content inside output.
		<section
			role="status"
			aria-live="polite"
			data-booking-state={booking.status}
			className={`rounded-2xl border p-3.5 text-xs ${
				isExpired
					? "border-rose-200 bg-rose-50 text-rose-950"
					: "border-emerald-200 bg-emerald-50 text-emerald-950"
			}`}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{isExpired ? (
						<Clock3 className="size-4 shrink-0 text-rose-700" />
					) : (
						<Check className="size-4 shrink-0 text-emerald-700" />
					)}
					<h3 className="text-xs font-extrabold">
						{isExpired
							? "Đơn đặt chỗ đã hết hạn"
							: isFreeConfirmed
								? "Đặt chỗ đã được xác nhận"
								: "Đã tạo đặt chỗ thành công"}
					</h3>
				</div>
				<div className="flex items-center gap-1 font-bold">
					<span
						data-testid="booking-code-badge"
						title={`Mã đặt chỗ đầy đủ: ${booking.id}`}
						className={`rounded-md border bg-white px-1.5 py-0.5 font-mono text-[11px] font-extrabold shadow-2xs ${
							isExpired ? "border-rose-200 text-rose-900" : "border-emerald-200 text-[#164027]"
						}`}
					>
						#{booking.id.slice(0, 8).toUpperCase()}
					</span>
					<span className="sr-only">{booking.id}</span>
					<button
						type="button"
						onClick={handleCopyId}
						title={copied ? "Đã sao chép mã đầy đủ" : "Sao chép mã UUID"}
						aria-label="Sao chép mã đặt chỗ"
						className={`rounded p-0.5 transition ${
							isExpired
								? "text-rose-800 hover:bg-rose-100 hover:text-rose-950"
								: "text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
						}`}
					>
						{copied ? (
							<Check className={`size-3 ${isExpired ? "text-rose-700" : "text-emerald-700"}`} />
						) : (
							<Copy className="size-3" />
						)}
					</button>
				</div>
			</div>

			<dl
				className={`mt-2.5 grid grid-cols-2 gap-2 border-t pt-2 text-[11px] ${
					isExpired ? "border-rose-200" : "border-emerald-200"
				}`}
			>
				<div>
					<dt className={isExpired ? "text-rose-900" : "text-emerald-900"}>Số lượng khách</dt>
					<dd className="font-bold">{booking.numPeople} người</dd>
				</div>
				<div className="text-right">
					<dt className={isExpired ? "text-rose-900" : "text-emerald-900"}>
						{isExpired ? "Tổng tiền đặt chỗ" : "Tổng giá gốc"}
					</dt>
					<dd
						data-testid="authoritative-booking-price"
						className={`font-extrabold ${isExpired ? "text-rose-900" : "text-[#164027]"}`}
					>
						{formatVND(Number(booking.basePrice))}
					</dd>
				</div>
				{booking.totalAmount && Number(booking.totalAmount) !== Number(booking.basePrice) && (
					<>
						<div>
							<dt className="text-emerald-900">Thiết bị thuê kèm</dt>
							<dd className="font-bold text-[#164027]">
								+{formatVND(Number(booking.totalAmount) - Number(booking.basePrice))}
							</dd>
						</div>
						<div className="text-right">
							<dt className="text-emerald-900">Tổng thanh toán</dt>
							<dd
								data-testid="authoritative-total-amount"
								className="font-extrabold text-[#164027]"
							>
								{formatVND(Number(booking.totalAmount))}
							</dd>
						</div>
					</>
				)}
				<div>
					<dt className={isExpired ? "text-rose-900" : "text-emerald-900"}>Trạng thái</dt>
					<dd className="font-bold">
						<span
							className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getBookingStatusBadge(isExpired ? "expired" : booking.status)}`}
						>
							{formatBookingStatus(isExpired ? "expired" : booking.status)}
						</span>
						<span className="sr-only"> ({booking.status})</span>
					</dd>
				</div>
				<div className="text-right">
					<dt className={isExpired ? "text-rose-900" : "text-emerald-900"}>Thanh toán</dt>
					<dd className="font-bold">
						<span
							className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getPaymentStatusBadge(booking.paymentStatus)}`}
						>
							{formatPaymentStatus(booking.paymentStatus)}
						</span>
						<span className="sr-only"> ({booking.paymentStatus})</span>
					</dd>
				</div>
				{isPendingPayment && booking.holdExpiresAt && (
					<div className="col-span-2 flex items-center justify-between text-amber-900">
						<dt>Giữ chỗ đến</dt>
						<dd className="font-extrabold">{formatBookingDateTime(booking.holdExpiresAt)}</dd>
					</div>
				)}
				{isHoldOverdue && booking.holdExpiresAt && (
					<div className="col-span-2 flex items-center justify-between text-rose-800">
						<dt>Hết hạn lúc</dt>
						<dd className="font-extrabold">{formatBookingDateTime(booking.holdExpiresAt)}</dd>
					</div>
				)}
			</dl>

			<div className="mt-3 flex gap-2">
				{onViewBookingDetails && (
					<button
						type="button"
						onClick={() => onViewBookingDetails(booking.id)}
						className="flex-1 rounded-xl bg-[#164027] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
					>
						Xem chi tiết đặt chỗ
					</button>
				)}

				{onReset && (
					<button
						type="button"
						onClick={onReset}
						className={`rounded-xl border bg-white px-3 py-2 text-xs font-bold transition ${
							isExpired
								? "border-rose-300 text-rose-900 hover:bg-rose-100"
								: "border-emerald-300 text-emerald-900 hover:bg-emerald-100"
						}`}
					>
						{isExpired ? "Đặt chỗ lại" : "Đặt lại"}
					</button>
				)}
			</div>
		</section>
	);
}

export function BookingPanel({
	trip,
	bookingAccess = "camper",
	booking = null,
	isBooking = false,
	bookingError = null,
	fieldErrors = {},
	isConflict = false,
	canRetry = false,
	equipmentRentalTotal = 0,
	equipmentRentalCount = 0,
	onBook,
	onRetry,
	onReset,
	onSignIn,
	onConflictDismiss,
	onConflictReload,
	onViewBookingDetails,
}: BookingPanelProps) {
	const inputId = useId();
	const errorId = `${inputId}-error`;
	const [numPeople, setNumPeople] = useState("1");
	const [localError, setLocalError] = useState<string | null>(null);
	const parsedValue = Number(numPeople);
	const displayedValue = Number.isFinite(parsedValue) ? parsedValue : 0;
	const fieldError = localError ?? fieldErrors.numPeople ?? null;
	const isSoldOut = trip.remainingSeats === 0;
	const isBookingClosed = new Date(trip.bookingDeadline) <= new Date();

	useEffect(() => {
		if (fieldErrors.numPeople) setLocalError(null);
	}, [fieldErrors.numPeople]);

	const validate = () => {
		const result = bookTripSchema.safeParse({ numPeople });
		if (!result.success) {
			setLocalError(result.error.issues[0]?.message ?? "Thông tin đặt chỗ không hợp lệ");
			return null;
		}
		setLocalError(null);
		return result.data.numPeople;
	};

	const adjust = (delta: number) => {
		const current = Number.isInteger(parsedValue) ? parsedValue : 1;
		const next = Math.max(1, current + delta);
		if (trip.remainingSeats !== null && next > trip.remainingSeats) return;
		setNumPeople(String(next));
		setLocalError(null);
	};

	const submit = () => {
		const value = validate();
		if (value !== null) void onBook?.(trip.id, value);
	};

	if (booking) {
		return (
			<BookingResult
				booking={booking}
				onReset={onReset}
				onViewBookingDetails={onViewBookingDetails}
			/>
		);
	}

	if (bookingAccess === "anonymous") {
		return (
			<div className="rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4 text-center text-xs text-[#52665b]">
				<p className="font-bold text-[#10221b]">
					Vui lòng đăng nhập bằng tài khoản Camper để đặt chỗ.
				</p>
				{onSignIn && (
					<button
						type="button"
						onClick={onSignIn}
						className="mt-3 rounded-xl bg-[#164027] px-5 py-2.5 font-bold text-white"
					>
						Đăng nhập để đặt chỗ
					</button>
				)}
			</div>
		);
	}

	if (bookingAccess === "non-camper") {
		return (
			<output className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
				<ShieldAlert className="size-4 shrink-0" />
				<span>
					Tài khoản hiện tại không có quyền đặt chỗ. Chỉ tài khoản Camper có thể thực hiện thao tác
					này.
				</span>
			</output>
		);
	}

	let blockedMessage: string | null = null;
	if (isSoldOut) blockedMessage = "Đã hết chỗ";
	else if (isBookingClosed) blockedMessage = "Đã hết hạn đặt chỗ";
	else if (!trip.isBookable) blockedMessage = "Hiện không thể đặt chỗ cho chuyến đi này";

	if (blockedMessage) {
		return (
			<button
				type="button"
				disabled
				className="w-full cursor-not-allowed rounded-2xl bg-gray-200 py-3.5 text-sm font-bold text-gray-600"
			>
				{blockedMessage}
			</button>
		);
	}

	return (
		<div>
			<div className="border-t border-[#edf3ed] pt-4">
				<div className="flex items-end justify-between gap-4">
					<div>
						<label htmlFor={inputId} className="text-xs font-bold text-[#10221b]">
							Số lượng khách
						</label>
						<p className="text-[11px] text-[#667a6d]">
							{trip.remainingSeats !== null
								? `Tối đa ${trip.remainingSeats} chỗ theo dữ liệu hiện tại`
								: "Theo sức chứa"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							aria-label="Giảm số lượng khách"
							onClick={() => adjust(-1)}
							disabled={isBooking || displayedValue <= 1}
							className="flex size-8 items-center justify-center rounded-xl border border-[#dfe8df] text-[#164027] disabled:cursor-not-allowed disabled:opacity-40"
						>
							<Minus className="size-3.5" />
						</button>
						<input
							id={inputId}
							data-testid="num-people-value"
							type="number"
							inputMode="numeric"
							min={1}
							step={1}
							value={numPeople}
							onChange={(event) => {
								setNumPeople(event.target.value);
								setLocalError(null);
							}}
							onBlur={validate}
							aria-invalid={Boolean(fieldError)}
							aria-describedby={fieldError ? errorId : undefined}
							disabled={isBooking}
							className="h-8 w-16 rounded-xl border border-[#dfe8df] text-center text-sm font-extrabold text-[#10221b] disabled:opacity-60"
						/>
						<button
							type="button"
							aria-label="Tăng số lượng khách"
							onClick={() => adjust(1)}
							disabled={
								isBooking || (trip.remainingSeats !== null && displayedValue >= trip.remainingSeats)
							}
							className="flex size-8 items-center justify-center rounded-xl border border-[#dfe8df] text-[#164027] disabled:cursor-not-allowed disabled:opacity-40"
						>
							<Plus className="size-3.5" />
						</button>
					</div>
				</div>
				{fieldError && (
					<p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-rose-700">
						{fieldError}
					</p>
				)}
				{equipmentRentalTotal > 0 ? (
					<div className="mt-3 space-y-1.5 rounded-xl bg-[#f4f7f2] p-2.5 text-xs">
						<div className="flex items-baseline justify-between text-[#667a6d]">
							<span>Vé chuyến đi ({displayedValue} khách):</span>
							<span>{formatVND(trip.pricePerPerson * Math.max(0, displayedValue))}</span>
						</div>
						<div className="flex items-baseline justify-between text-[#667a6d]">
							<span>Thiết bị thuê kèm ({equipmentRentalCount} món):</span>
							<span className="font-semibold text-[#164027]">
								+{formatVND(equipmentRentalTotal)}
							</span>
						</div>
						<div className="flex items-baseline justify-between border-t border-[#dfe8df] pt-1.5 font-bold">
							<span className="text-[#10221b]">Tạm tính:</span>
							<span data-testid="booking-total-price" className="font-extrabold text-[#164027]">
								{formatVND(
									trip.pricePerPerson * Math.max(0, displayedValue) + equipmentRentalTotal
								)}
							</span>
						</div>
					</div>
				) : (
					<div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#f4f7f2] p-2.5 text-xs">
						<span className="font-semibold text-[#667a6d]">Tạm tính:</span>
						<span data-testid="booking-total-price" className="font-extrabold text-[#164027]">
							{formatVND(trip.pricePerPerson * Math.max(0, displayedValue))}
						</span>
					</div>
				)}
			</div>

			<button
				type="button"
				disabled={isBooking}
				onClick={submit}
				className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#164027] py-3.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-75"
			>
				{isBooking ? (
					<>
						<Loader2 className="size-4 animate-spin" />
						<span>Đang xử lý đặt chỗ...</span>
					</>
				) : (
					<span>Đặt chỗ ngay</span>
				)}
			</button>

			{bookingError && !isConflict && (
				<div
					role="alert"
					className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-semibold text-rose-700"
				>
					<p>{bookingError}</p>
					{canRetry && onRetry && (
						<button
							type="button"
							onClick={() => void onRetry()}
							disabled={isBooking}
							className="mt-2 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 font-bold disabled:opacity-50"
						>
							{isBooking ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<RefreshCw className="size-3.5" />
							)}
							{isBooking ? "Đang thử lại..." : "Thử lại"}
						</button>
					)}
				</div>
			)}

			<p className="mt-3 text-center text-[11px] text-[#8fa096]">Xác nhận tức thì • Hỗ trợ 24/7</p>

			<BookingConflictDialog
				open={isConflict}
				message={bookingError}
				requestedSeats={Number.isInteger(parsedValue) ? parsedValue : undefined}
				isReloading={isBooking}
				onClose={onConflictDismiss ?? (() => {})}
				onReload={onConflictReload ?? (() => {})}
				onRetry={onRetry ? () => void onRetry() : undefined}
			/>
		</div>
	);
}
