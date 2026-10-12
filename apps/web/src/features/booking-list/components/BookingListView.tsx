import { CalendarDays, Clock3, ReceiptText, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "../../../shared/components/Pagination";
import type { BookingPaymentStatus, BookingStatus } from "../../booking-details/types";
import {
	formatBookingDateTime,
	formatBookingMoney,
	formatBookingStatus,
	formatPaymentStatus,
} from "../../booking-details/utils/booking-details-formatters";
import type { BookingListItem } from "../types";

export const BOOKING_LIST_PAGE_SIZE = 5;

type BookingStatusFilter = BookingStatus | "all";
type PaymentStatusFilter = BookingPaymentStatus | "all";

const BOOKING_STATUS_FILTERS: BookingStatus[] = [
	"pending_payment",
	"pending_reconfirmation",
	"confirmed",
	"cancelled",
	"expired",
	"completed",
];
const PAYMENT_STATUS_FILTERS: BookingPaymentStatus[] = ["not_required", "unpaid", "paid"];

function getBookingStatusBadge(status: BookingListItem["status"]): string {
	if (status === "cancelled" || status === "expired") return "bg-rose-100 text-rose-800";
	if (status === "completed") return "bg-sky-100 text-sky-800";
	return "bg-emerald-100 text-emerald-900";
}

export function BookingListView({
	bookings,
	onViewDetails,
}: {
	bookings: BookingListItem[];
	onViewDetails: (bookingId: string) => void;
}) {
	const [bookingStatus, setBookingStatus] = useState<BookingStatusFilter>("all");
	const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("all");
	const [page, setPage] = useState(1);

	const filteredBookings = useMemo(
		() =>
			bookings.filter(
				(booking) =>
					(bookingStatus === "all" || booking.status === bookingStatus) &&
					(paymentStatus === "all" || booking.paymentStatus === paymentStatus)
			),
		[bookings, bookingStatus, paymentStatus]
	);
	const totalPages = Math.ceil(filteredBookings.length / BOOKING_LIST_PAGE_SIZE);
	const currentPage = Math.min(page, Math.max(totalPages, 1));
	const visibleBookings = filteredBookings.slice(
		(currentPage - 1) * BOOKING_LIST_PAGE_SIZE,
		currentPage * BOOKING_LIST_PAGE_SIZE
	);

	return (
		<main className="min-h-screen bg-[#f4f7f2] px-4 py-6 text-[#10221b] sm:px-6">
			<div className="mx-auto max-w-5xl">
				<header className="rounded-3xl bg-[#164027] p-5 text-white shadow-sm sm:p-6">
					<p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Camper</p>
					<h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Đơn đặt chỗ của bạn</h1>
					<p className="mt-1 text-sm text-emerald-100">
						Xem lại các đơn đã tạo và mở chi tiết từ dữ liệu máy chủ.
					</p>
				</header>

				{bookings.length === 0 ? (
					<p className="mt-4 rounded-2xl bg-white p-6 text-center text-sm text-[#667a6d] shadow-sm">
						Bạn chưa có đơn đặt chỗ nào.
					</p>
				) : (
					<>
						<section
							aria-label="Bộ lọc đơn đặt chỗ"
							className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2"
						>
							<label className="text-sm font-bold" htmlFor="booking-status-filter">
								Trạng thái đơn
								<select
									id="booking-status-filter"
									className="mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-sm"
									value={bookingStatus}
									onChange={(event) => {
										setBookingStatus(event.target.value as BookingStatusFilter);
										setPage(1);
									}}
								>
									<option value="all">Tất cả trạng thái đơn</option>
									{BOOKING_STATUS_FILTERS.map((status) => (
										<option key={status} value={status}>
											{formatBookingStatus(status)}
										</option>
									))}
								</select>
							</label>
							<label className="text-sm font-bold" htmlFor="payment-status-filter">
								Trạng thái thanh toán
								<select
									id="payment-status-filter"
									className="mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-sm"
									value={paymentStatus}
									onChange={(event) => {
										setPaymentStatus(event.target.value as PaymentStatusFilter);
										setPage(1);
									}}
								>
									<option value="all">Tất cả trạng thái thanh toán</option>
									{PAYMENT_STATUS_FILTERS.map((status) => (
										<option key={status} value={status}>
											{formatPaymentStatus(status)}
										</option>
									))}
								</select>
							</label>
						</section>

						{visibleBookings.length === 0 ? (
							<p className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-[#667a6d] shadow-sm">
								Không tìm thấy đơn đặt chỗ phù hợp với bộ lọc.
							</p>
						) : (
							<ul aria-label="Danh sách đơn đặt chỗ" className="mt-3 grid gap-3">
								{visibleBookings.map((booking) => (
									<li key={booking.id}>
										<BookingCard booking={booking} onViewDetails={onViewDetails} />
									</li>
								))}
							</ul>
						)}

						<Pagination
							currentPage={currentPage}
							totalPages={totalPages}
							totalItems={filteredBookings.length}
							itemsPerPage={BOOKING_LIST_PAGE_SIZE}
							onPageChange={setPage}
						/>
					</>
				)}
			</div>
		</main>
	);
}

function BookingCard({
	booking,
	onViewDetails,
}: {
	booking: BookingListItem;
	onViewDetails: (bookingId: string) => void;
}) {
	return (
		<article className="rounded-2xl border border-[#e5eee7] bg-white p-4 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-extrabold sm:text-lg">
						{booking.tripPresentation?.currentTitle ?? "Chuyến đi không còn thông tin hiển thị"}
					</h2>
					<p className="mt-0.5 break-all text-xs text-[#667a6d]">Mã: {booking.id}</p>
				</div>
				<div className="flex flex-wrap gap-1.5 text-xs font-bold">
					<span
						data-testid={`booking-status-${booking.id}`}
						className={`rounded-full px-2.5 py-1 ${getBookingStatusBadge(booking.status)}`}
					>
						{formatBookingStatus(booking.status)}
					</span>
					<span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
						{formatPaymentStatus(booking.paymentStatus)}
					</span>
				</div>
			</div>
			<dl className="mt-3 grid gap-2 border-t border-[#e5eee7] pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
				<div className="flex gap-2 sm:col-span-2">
					<CalendarDays className="mt-0.5 size-4 shrink-0 text-[#667a6d]" />
					<div>
						<dt className="text-xs text-[#667a6d]">Lịch đi</dt>
						<dd className="font-bold">
							{formatBookingDateTime(booking.tripStartsAtSnapshot)} –{" "}
							{formatBookingDateTime(booking.tripEndsAtSnapshot)}
						</dd>
					</div>
				</div>
				<Summary icon={Users} label="Số người" value={booking.numPeople ?? "Chưa cập nhật"} />
				<Summary
					icon={ReceiptText}
					label="Tổng tiền"
					value={formatBookingMoney(booking.totalAmount)}
				/>
				<Summary icon={Clock3} label="Ngày tạo" value={formatBookingDateTime(booking.createdAt)} />
				<div className="flex items-end justify-start lg:justify-end">
					<button
						type="button"
						onClick={() => onViewDetails(booking.id)}
						className="rounded-xl bg-[#164027] px-4 py-2 text-sm font-bold text-white"
					>
						Xem chi tiết
					</button>
				</div>
			</dl>
		</article>
	);
}

function Summary({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Users;
	label: string;
	value: string | number;
}) {
	return (
		<div className="flex gap-2">
			<Icon className="mt-0.5 size-4 shrink-0 text-[#667a6d]" />
			<div>
				<dt className="text-xs text-[#667a6d]">{label}</dt>
				<dd className="font-bold">{value}</dd>
			</div>
		</div>
	);
}
