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
	if (result) return <CancellationResultCard result={result} />;
	if (booking.status === "cancelled")
		return (
			<section
				aria-label="Đơn đã hủy"
				className="rounded-2xl border border-[#cbd9ce] bg-white p-5 text-sm"
			>
				<p>Đơn đặt chỗ đã hủy và không còn quyền tham gia chuyến đi.</p>
				<p className="mt-2">Thông tin hoàn tiền không có trong dữ liệu chi tiết hiện tại.</p>
			</section>
		);
	// Presentation only. Policy, schedule and equipment eligibility are server-owned.
	const relevant =
		booking.status === "confirmed" &&
		(booking.paymentStatus === "paid" || booking.paymentStatus === "not_required");
	if (!relevant) return null;
	return (
		<section
			aria-label="Hủy đơn đặt chỗ"
			className="rounded-2xl border border-rose-200 bg-white p-5"
		>
			<h2 className="font-extrabold">Hủy đơn đặt chỗ</h2>
			<p className="mt-2 text-sm">Yêu cầu hủy sẽ được máy chủ kiểm tra theo chính sách của đơn.</p>
			<button
				type="button"
				disabled={isSubmitting || isRefreshing}
				onClick={() => setOpen(true)}
				className="mt-3 rounded-xl border border-rose-700 px-4 py-2 font-bold text-rose-700 disabled:opacity-50"
			>
				Yêu cầu hủy đơn
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
