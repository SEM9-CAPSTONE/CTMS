import { useState } from "react";
import type { BookingDetails } from "../../booking-details/types";
import type {
	BookingCancellationError,
	CancelBookingRequest,
	CancelBookingResponse,
} from "../types";
import { CancelBookingDialog } from "./CancelBookingDialog";
import { CancellationResultCard } from "./CancellationResultCard";

interface Props {
	booking: BookingDetails;
	result: CancelBookingResponse | null;
	error: BookingCancellationError | null;
	isSubmitting: boolean;
	isRefreshing: boolean;
	onSubmit: (input: CancelBookingRequest) => Promise<void>;
	onReload: () => void;
	onBack: () => void;
}

export function BookingCancellationPanel({
	booking,
	result,
	error,
	isSubmitting,
	isRefreshing,
	onSubmit,
	onReload,
	onBack,
}: Props) {
	const [open, setOpen] = useState(false);
	const rebook = (
		<a
			className="mt-3 inline-block rounded-xl border border-emerald-800 px-4 py-2 font-bold text-emerald-900"
			href={`/trips/${booking.tripId}?rebook=${booking.id}`}
		>
			Xem chuyến và đặt lại
		</a>
	);
	if (result)
		return (
			<div>
				<CancellationResultCard result={result} />
				{rebook}
			</div>
		);
	if (booking.status === "cancelled")
		return (
			<section
				aria-label="Đơn đã hủy"
				className="rounded-2xl border border-[#cbd9ce] bg-white p-5 text-sm"
			>
				<p>Đơn đặt chỗ đã hủy và không còn quyền tham gia chuyến đi.</p>
				{rebook}
			</section>
		);
	// Presentation only. Policy, schedule and equipment eligibility are server-owned.
	const relevant =
		booking.status === "confirmed" &&
		(booking.paymentStatus === "paid" || booking.paymentStatus === "not_required");
	if (!relevant) return null;
	return (
		<section
			aria-label="Hủy đặt chỗ trước chuyến đi"
			className="rounded-2xl border border-rose-200 bg-white p-5"
		>
			<h2 className="text-lg font-semibold">Hủy đặt chỗ trước chuyến đi</h2>
			<p className="mt-3 text-sm text-[#667a6d]">
				Bạn không thể tham gia chuyến đi? Hủy đặt chỗ sẽ hủy chỗ của toàn bộ người trong đơn. Khoản
				hoàn, nếu có, được tính theo chính sách hủy.
			</p>
			<p className="mt-3 text-xs text-[#667a6d]">
				Sau khi hủy thành công, bạn theo dõi khoản hoàn tại phần “Hoàn tiền sau khi hủy đặt chỗ”.
			</p>
			<button
				type="button"
				disabled={isSubmitting || isRefreshing}
				onClick={() => setOpen(true)}
				className="mt-3 rounded-xl border border-rose-700 px-4 py-2 font-bold text-rose-700 disabled:opacity-50"
			>
				Hủy đặt chỗ
			</button>
			<CancelBookingDialog
				open={open}
				isSubmitting={isSubmitting}
				isRefreshing={isRefreshing}
				error={error}
				onSubmit={onSubmit}
				onClose={() => setOpen(false)}
				onReload={onReload}
				onBack={onBack}
			/>
		</section>
	);
}
