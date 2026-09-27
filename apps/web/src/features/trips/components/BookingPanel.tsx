import { Check, Loader2, Minus, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
	onBook?: (tripId: string, numPeople: number) => void | Promise<void>;
	onRetry?: () => unknown;
	onReset?: () => void;
	onSignIn?: () => void;
	onConflictDismiss?: () => void;
	onConflictReload?: () => void;
}

function BookingResult({ booking, onReset }: { booking: BookTripResponse; onReset?: () => void }) {
	const isFreeConfirmed =
		booking.status === "confirmed" && booking.paymentStatus === "not_required";
	const isPendingPayment =
		booking.status === "pending_payment" && booking.paymentStatus === "unpaid";

	return (
		// biome-ignore lint/a11y/useSemanticElements: The live status contains structured Booking details that are not valid phrasing content inside output.
		<section
			role="status"
			aria-live="polite"
			className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
		>
			<div className="flex items-start gap-3">
				<Check className="mt-0.5 size-5 shrink-0 text-emerald-700" />
				<div>
					<h3 className="font-extrabold">
						{isFreeConfirmed ? "Đặt chỗ đã được xác nhận" : "Đã tạo đặt chỗ thành công"}
					</h3>
					<p className="mt-1 text-xs text-emerald-800">
						{isPendingPayment
							? "Đặt chỗ đang chờ thanh toán. Hệ thống chưa ghi nhận thanh toán hoàn tất."
							: "Thông tin dưới đây đã được hệ thống xác nhận."}
					</p>
				</div>
			</div>

			<dl className="mt-4 grid gap-2 border-t border-emerald-200 pt-3 text-xs">
				<div className="flex justify-between gap-3">
					<dt>Mã đặt chỗ</dt>
					<dd className="break-all text-right font-bold">{booking.id}</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt>Số lượng khách</dt>
					<dd className="font-bold">{booking.numPeople}</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt>Tổng giá đã xác nhận</dt>
					<dd data-testid="authoritative-booking-price" className="font-extrabold">
						{formatVND(Number(booking.basePrice))}
					</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt>Trạng thái đặt chỗ</dt>
					<dd className="font-bold">{booking.status}</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt>Trạng thái thanh toán</dt>
					<dd className="font-bold">{booking.paymentStatus}</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt>Lịch trình</dt>
					<dd className="text-right font-bold">
						{formatBookingDateTime(booking.tripStartsAtSnapshot)} –{" "}
						{formatBookingDateTime(booking.tripEndsAtSnapshot)}
					</dd>
				</div>
				{isPendingPayment && booking.holdExpiresAt && (
					<div className="flex justify-between gap-3 text-amber-900">
						<dt>Giữ chỗ đến</dt>
						<dd className="text-right font-extrabold">
							{formatBookingDateTime(booking.holdExpiresAt)}
						</dd>
					</div>
				)}
			</dl>

			{onReset && (
				<button
					type="button"
					onClick={onReset}
					className="mt-4 w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
				>
					Tạo đặt chỗ khác
				</button>
			)}
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
	onBook,
	onRetry,
	onReset,
	onSignIn,
	onConflictDismiss,
	onConflictReload,
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

	if (booking) return <BookingResult booking={booking} onReset={onReset} />;

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
				<div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#f4f7f2] p-2.5 text-xs">
					<span className="font-semibold text-[#667a6d]">Tạm tính:</span>
					<span data-testid="booking-total-price" className="font-extrabold text-[#164027]">
						{formatVND(trip.pricePerPerson * Math.max(0, displayedValue))}
					</span>
				</div>
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
