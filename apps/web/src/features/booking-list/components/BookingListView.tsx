import { CalendarDays, ReceiptText, Users } from "lucide-react";
import {
	formatBookingDateTime,
	formatBookingMoney,
	formatBookingStatus,
	formatPaymentStatus,
} from "../../booking-details/utils/booking-details-formatters";
import type { BookingListItem } from "../types";

function getBookingStatusBadge(status: BookingListItem["status"]): string {
	if (status === "cancelled" || status === "expired") {
		return "bg-rose-100 text-rose-800";
	}

	return "bg-emerald-100 text-emerald-900";
}

export function BookingListView({
	bookings,
	onViewDetails,
}: {
	bookings: BookingListItem[];
	onViewDetails: (bookingId: string) => void;
}) {
	return (
		<main className="min-h-screen bg-[#f4f7f2] px-4 py-8 text-[#10221b] sm:px-6">
			<div className="mx-auto max-w-5xl">
				<header className="rounded-3xl bg-[#164027] p-6 text-white shadow-sm sm:p-8">
					<p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Camper</p>
					<h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Đơn đặt chỗ của bạn</h1>
					<p className="mt-2 text-sm text-emerald-100">
						Xem lại các đơn đã tạo và mở chi tiết từ dữ liệu máy chủ.
					</p>
				</header>

				{bookings.length === 0 ? (
					<p className="mt-6 rounded-3xl bg-white p-8 text-center text-sm text-[#667a6d] shadow-sm">
						Bạn chưa có đơn đặt chỗ nào.
					</p>
				) : (
					<ul aria-label="Danh sách đơn đặt chỗ" className="mt-6 grid gap-5">
						{bookings.map((booking) => (
							<li key={booking.id}>
								<article className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
									<div className="flex flex-wrap items-start justify-between gap-4">
										<div>
											<h2 className="text-lg font-extrabold">
												{booking.tripPresentation?.currentTitle ??
													"Chuyến đi không còn thông tin hiển thị"}
											</h2>
											<p className="mt-1 break-all text-xs text-[#667a6d]">Mã: {booking.id}</p>
										</div>
										<div className="flex flex-wrap gap-2 text-xs font-bold">
											<span
												data-testid={`booking-status-${booking.id}`}
												className={`rounded-full px-3 py-1 ${getBookingStatusBadge(booking.status)}`}
											>
												{formatBookingStatus(booking.status)}
											</span>
											<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
												{formatPaymentStatus(booking.paymentStatus)}
											</span>
										</div>
									</div>
									<dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
										<div className="flex gap-2">
											<CalendarDays className="size-4 shrink-0" />
											<div>
												<dt className="text-[#667a6d]">Lịch đi</dt>
												<dd className="font-bold">
													{formatBookingDateTime(booking.tripStartsAtSnapshot)} –{" "}
													{formatBookingDateTime(booking.tripEndsAtSnapshot)}
												</dd>
											</div>
										</div>
										<div className="flex gap-2">
											<Users className="size-4 shrink-0" />
											<div>
												<dt className="text-[#667a6d]">Số người</dt>
												<dd className="font-bold">{booking.numPeople ?? "Chưa cập nhật"}</dd>
											</div>
										</div>
										<div className="flex gap-2">
											<ReceiptText className="size-4 shrink-0" />
											<div>
												<dt className="text-[#667a6d]">Tổng tiền</dt>
												<dd className="font-bold">{formatBookingMoney(booking.totalAmount)}</dd>
											</div>
										</div>
										<div>
											<dt className="text-[#667a6d]">Ngày tạo</dt>
											<dd className="font-bold">{formatBookingDateTime(booking.createdAt)}</dd>
										</div>
									</dl>
									<button
										type="button"
										onClick={() => onViewDetails(booking.id)}
										className="mt-5 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white"
									>
										Xem chi tiết
									</button>
								</article>
							</li>
						))}
					</ul>
				)}
			</div>
		</main>
	);
}
