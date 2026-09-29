import { CalendarDays, CreditCard, FileText, MapPin, ReceiptText } from "lucide-react";
import type { BookingDetails } from "../types";
import {
	formatBookingDateTime,
	formatBookingMoney,
	formatBookingStatus,
	formatPaymentStatus,
} from "../utils/booking-details-formatters";
import { BookingEquipmentSection } from "./BookingEquipmentSection";
import { BookingMembersSection } from "./BookingMembersSection";

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-[#edf3ed] py-3 last:border-0">
			<dt className="text-sm text-[#667a6d]">{label}</dt>
			<dd className="text-right text-sm font-bold text-[#10221b]">{value}</dd>
		</div>
	);
}

function cancellationPolicyText(snapshot: Record<string, unknown>): string | null {
	return typeof snapshot.policy === "string" ? snapshot.policy : null;
}

export function BookingDetailsView({
	booking,
	onBack,
	backLabel = "Quay lại đơn đặt chỗ",
}: {
	booking: BookingDetails;
	onBack: () => void;
	backLabel?: string;
}) {
	const policyText = booking.cancellationPolicySnapshot
		? cancellationPolicyText(booking.cancellationPolicySnapshot)
		: null;

	return (
		<main className="min-h-screen bg-[#f4f7f2] px-4 py-8 text-[#10221b] sm:px-6">
			<div className="mx-auto max-w-5xl">
				<button
					type="button"
					onClick={onBack}
					className="mb-5 rounded-xl border border-[#cbd9ce] bg-white px-4 py-2 text-sm font-bold text-[#164027]"
				>
					{backLabel}
				</button>

				<header className="rounded-3xl bg-[#164027] p-6 text-white shadow-sm sm:p-8">
					<p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Đơn đặt chỗ</p>
					<h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Chi tiết đơn đặt chỗ</h1>
					<p className="mt-2 break-all text-sm text-emerald-100">Mã: {booking.id}</p>
					<div className="mt-5 flex flex-wrap gap-2">
						<span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#164027]">
							Trạng thái: {formatBookingStatus(booking.status)}
						</span>
						<span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-900">
							Thanh toán: {formatPaymentStatus(booking.paymentStatus)}
						</span>
					</div>
				</header>

				<div className="mt-6 grid gap-6 lg:grid-cols-2">
					<section
						aria-labelledby="booking-trip-heading"
						className="rounded-3xl bg-white p-6 shadow-sm"
					>
						<h2
							id="booking-trip-heading"
							className="flex items-center gap-2 text-lg font-extrabold"
						>
							<MapPin className="size-5 text-[#164027]" /> Chuyến đi
						</h2>
						{booking.tripPresentation ? (
							<div className="mt-4 rounded-2xl bg-[#f4f7f2] p-4">
								<p className="font-extrabold">{booking.tripPresentation.currentTitle}</p>
								<p className="mt-1 text-sm text-[#667a6d]">
									{booking.tripPresentation.currentRouteName}
								</p>
							</div>
						) : (
							<p className="mt-4 text-sm text-[#667a6d]">
								Không còn thông tin tên chuyến đi hiện tại.
							</p>
						)}
						<dl className="mt-3">
							<SummaryRow
								label="Bắt đầu theo lịch đã đặt"
								value={formatBookingDateTime(booking.tripStartsAtSnapshot)}
							/>
							<SummaryRow
								label="Kết thúc theo lịch đã đặt"
								value={formatBookingDateTime(booking.tripEndsAtSnapshot)}
							/>
						</dl>
					</section>

					<section
						aria-labelledby="booking-summary-heading"
						className="rounded-3xl bg-white p-6 shadow-sm"
					>
						<h2
							id="booking-summary-heading"
							className="flex items-center gap-2 text-lg font-extrabold"
						>
							<ReceiptText className="size-5 text-[#164027]" /> Thông tin đặt chỗ
						</h2>
						<dl className="mt-3">
							<SummaryRow label="Số người" value={booking.numPeople ?? "Chưa cập nhật"} />
							<SummaryRow label="Ngày tạo" value={formatBookingDateTime(booking.createdAt)} />
							<SummaryRow label="Giá cơ bản" value={formatBookingMoney(booking.basePrice)} />
							<SummaryRow
								label="Tổng tiền"
								value={
									<span data-testid="authoritative-total-amount">
										{formatBookingMoney(booking.totalAmount)}
									</span>
								}
							/>
						</dl>
					</section>

					<BookingMembersSection members={booking.members} />
					<BookingEquipmentSection items={booking.equipmentItems} />

					<section
						aria-labelledby="booking-payment-heading"
						className="rounded-3xl bg-white p-6 shadow-sm"
					>
						<h2
							id="booking-payment-heading"
							className="flex items-center gap-2 text-lg font-extrabold"
						>
							<CreditCard className="size-5 text-[#164027]" /> Thanh toán
						</h2>
						<dl className="mt-3">
							<SummaryRow label="Trạng thái" value={formatPaymentStatus(booking.paymentStatus)} />
							{booking.holdExpiresAt && (
								<SummaryRow
									label="Giữ chỗ đến"
									value={formatBookingDateTime(booking.holdExpiresAt)}
								/>
							)}
						</dl>
					</section>

					<section
						aria-labelledby="booking-cancellation-heading"
						className="rounded-3xl bg-white p-6 shadow-sm"
					>
						<h2
							id="booking-cancellation-heading"
							className="flex items-center gap-2 text-lg font-extrabold"
						>
							<FileText className="size-5 text-[#164027]" /> Chính sách hủy
						</h2>
						{booking.cancellationPolicySnapshot ? (
							policyText ? (
								<p className="mt-4 text-sm text-[#52665b]">{policyText}</p>
							) : (
								<pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f4f7f2] p-4 text-xs text-[#52665b]">
									{JSON.stringify(booking.cancellationPolicySnapshot, null, 2)}
								</pre>
							)
						) : (
							<p className="mt-4 text-sm text-[#667a6d]">
								Không có chính sách hủy được lưu cho đơn này.
							</p>
						)}
					</section>
				</div>

				<section
					aria-labelledby="booking-schedule-note-heading"
					className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
				>
					<h2
						id="booking-schedule-note-heading"
						className="flex items-center gap-2 text-sm font-extrabold text-emerald-950"
					>
						<CalendarDays className="size-5" /> Lịch trình của đơn đặt chỗ
					</h2>
					<p className="mt-1 text-xs text-emerald-800">
						Thời gian hiển thị là lịch trình đã được lưu khi tạo đơn đặt chỗ.
					</p>
				</section>
			</div>
		</main>
	);
}
