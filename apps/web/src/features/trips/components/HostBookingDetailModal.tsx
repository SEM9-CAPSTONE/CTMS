import { Check, CheckCircle, Copy, Mail, Package, Phone, User, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import type {
	BookingMemberStatus,
	BookingPaymentStatus,
	BookingStatus,
} from "../../booking-details/types";
import {
	formatBookingDateTime,
	formatBookingMoney,
	formatBookingStatus,
	formatMemberStatus,
	formatPaymentStatus,
} from "../../booking-details/utils/booking-details-formatters";
import type { TripBookingItem, TripStatus } from "../types";
import { formatEquipmentCategory } from "./TripRentableEquipment";

export interface HostBookingDetailModalProps {
	isOpen: boolean;
	booking: TripBookingItem | null;
	tripStatus: TripStatus;
	onClose: () => void;
	onCompleteBooking?: (bookingId: string) => Promise<void> | void;
	isCompleting?: boolean;
}

function getBookingStatusBadgeClass(status: BookingStatus): string {
	switch (status) {
		case "confirmed":
			return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
		case "completed":
			return "bg-sky-50 text-sky-800 ring-1 ring-sky-200";
		case "pending_payment":
		case "pending_reconfirmation":
			return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
		case "cancelled":
		case "expired":
			return "bg-rose-50 text-rose-800 ring-1 ring-rose-200";
		default:
			return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
	}
}

function getPaymentStatusBadgeClass(paymentStatus: BookingPaymentStatus): string {
	switch (paymentStatus) {
		case "paid":
			return "bg-emerald-100 text-emerald-900";
		case "unpaid":
			return "bg-amber-100 text-amber-900";
		default:
			return "bg-slate-100 text-slate-700";
	}
}

export function HostBookingDetailModal({
	isOpen,
	booking,
	tripStatus,
	onClose,
	onCompleteBooking,
	isCompleting = false,
}: HostBookingDetailModalProps) {
	const [copiedId, setCopiedId] = useState(false);

	if (!booking) return null;

	const handleCopyId = () => {
		if (navigator.clipboard) {
			void navigator.clipboard.writeText(booking.id);
			setCopiedId(true);
			setTimeout(() => setCopiedId(false), 2000);
		}
	};

	const canComplete = tripStatus === "completed" && booking.status === "confirmed";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Chi tiết đơn #${booking.id.slice(0, 8).toUpperCase()}`}
			size="xl"
		>
			<div className="space-y-6">
				{/* Top Status & Booking Code Banner */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f4f7f2] p-4 border border-[#dfe8df]">
					<div className="flex items-center gap-2">
						<span
							className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBookingStatusBadgeClass(
								booking.status
							)}`}
						>
							{formatBookingStatus(booking.status)}
						</span>
						<span
							className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentStatusBadgeClass(
								booking.paymentStatus
							)}`}
						>
							{formatPaymentStatus(booking.paymentStatus)}
						</span>
					</div>

					<div className="flex items-center gap-2 text-xs text-[#55685a]">
						<span className="font-mono">{booking.id}</span>
						<button
							type="button"
							onClick={handleCopyId}
							className="inline-flex items-center gap-1 rounded-lg border border-[#cbd9cd] bg-white px-2 py-1 text-xs font-medium text-[#10221b] hover:bg-[#edf5ee]"
							title="Sao chép toàn bộ mã đơn"
						>
							{copiedId ? (
								<>
									<Check className="size-3.5 text-emerald-600" />
									<span className="text-emerald-700 font-bold">Đã chép</span>
								</>
							) : (
								<>
									<Copy className="size-3.5" />
									<span>Sao chép</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Booker Info Section */}
				<section>
					<h4 className="text-sm font-extrabold text-[#10221b]">Thông tin người đặt</h4>
					<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
						<div className="flex items-center gap-2.5 rounded-xl border border-[#e7eee7] bg-[#fcfdfc] p-3">
							<User className="size-4 text-[#164027] shrink-0" />
							<div>
								<span className="text-[#667a6d]">Họ và tên:</span>
								<p className="font-extrabold text-[#10221b]">
									{booking.booker?.fullName || "Chưa cập nhật"}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2.5 rounded-xl border border-[#e7eee7] bg-[#fcfdfc] p-3">
							<Users className="size-4 text-[#164027] shrink-0" />
							<div>
								<span className="text-[#667a6d]">Số lượng người tham gia:</span>
								<p className="font-extrabold text-[#10221b]">{booking.numPeople} người</p>
							</div>
						</div>

						<div className="flex items-center gap-2.5 rounded-xl border border-[#e7eee7] bg-[#fcfdfc] p-3">
							<Mail className="size-4 text-[#164027] shrink-0" />
							<div className="truncate">
								<span className="text-[#667a6d]">Email:</span>
								<p className="font-semibold text-[#10221b] truncate">
									{booking.booker?.email || "Chưa cập nhật"}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2.5 rounded-xl border border-[#e7eee7] bg-[#fcfdfc] p-3">
							<Phone className="size-4 text-[#164027] shrink-0" />
							<div>
								<span className="text-[#667a6d]">Số điện thoại:</span>
								<p className="font-semibold text-[#10221b]">
									{booking.booker?.phone || "Chưa cập nhật"}
								</p>
							</div>
						</div>
					</div>

					<div className="mt-2 text-[11px] text-[#667a6d]">
						Thời gian đặt: {formatBookingDateTime(booking.createdAt)}
						{booking.completedAt && (
							<span> • Hoàn thành: {formatBookingDateTime(booking.completedAt)}</span>
						)}
					</div>
				</section>

				{/* Participants Section */}
				<section>
					<h4 className="text-sm font-extrabold text-[#10221b]">
						Danh sách người tham gia ({booking.members?.length || booking.numPeople})
					</h4>
					<div className="mt-3 overflow-hidden rounded-2xl border border-[#e7eee7]">
						<table className="w-full text-left text-xs">
							<thead className="bg-[#f4f7f2] text-[#4a5e51] font-bold">
								<tr>
									<th className="px-4 py-2.5">Họ tên</th>
									<th className="px-4 py-2.5">Email</th>
									<th className="px-4 py-2.5">Vai trò</th>
									<th className="px-4 py-2.5 text-right">Trạng thái</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#f0f4f0] bg-white">
								{booking.members && booking.members.length > 0 ? (
									booking.members.map((member) => (
										<tr key={member.id} className="hover:bg-[#fbfcfb]">
											<td className="px-4 py-2.5 font-bold text-[#10221b]">
												{member.displayName || member.email || "Khách"}
											</td>
											<td className="px-4 py-2.5 text-[#667a6d]">{member.email || "—"}</td>
											<td className="px-4 py-2.5">
												{member.isPrimary ? (
													<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">
														Người đặt chính
													</span>
												) : (
													<span className="text-[#667a6d]">Người đi cùng</span>
												)}
											</td>
											<td className="px-4 py-2.5 text-right text-[#55685a]">
												{formatMemberStatus(member.memberStatus as BookingMemberStatus)}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={4} className="px-4 py-3 text-center text-[#667a6d]">
											Chưa có danh sách thành viên chi tiết
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</section>

				{/* Hired Equipment Section */}
				<section>
					<div className="flex items-center gap-2">
						<Package className="size-4 text-[#164027]" />
						<h4 className="text-sm font-extrabold text-[#10221b]">
							Thiết bị camper thuê ({booking.equipmentItems.length} loại)
						</h4>
					</div>

					{booking.equipmentItems.length > 0 ? (
						<div className="mt-3 overflow-hidden rounded-2xl border border-[#e7eee7]">
							<table className="w-full text-left text-xs">
								<thead className="bg-[#edf5ee] text-[#164027] font-bold">
									<tr>
										<th className="px-4 py-2.5">Thiết bị</th>
										<th className="px-4 py-2.5">Phân loại</th>
										<th className="px-4 py-2.5 text-center">Số lượng</th>
										<th className="px-4 py-2.5 text-center">Thời gian</th>
										<th className="px-4 py-2.5 text-right">Đơn giá / ngày</th>
										<th className="px-4 py-2.5 text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-[#f0f4f0] bg-white">
									{booking.equipmentItems.map((item) => (
										<tr key={item.id} className="hover:bg-[#fbfcfb]">
											<td className="px-4 py-2.5 font-bold text-[#10221b]">{item.name}</td>
											<td className="px-4 py-2.5 text-[#55685a]">
												<span className="rounded-full bg-[#dfe8df] px-2 py-0.5 text-[10px] font-semibold text-[#4a5e51]">
													{formatEquipmentCategory(item.category)}
												</span>
											</td>
											<td className="px-4 py-2.5 text-center font-extrabold text-[#164027]">
												x{item.quantity}
											</td>
											<td className="px-4 py-2.5 text-center text-[#667a6d]">
												{item.rentalDays} ngày
											</td>
											<td className="px-4 py-2.5 text-right text-[#55685a]">
												{formatBookingMoney(item.unitPrice)}
											</td>
											<td className="px-4 py-2.5 text-right font-bold text-[#10221b]">
												{formatBookingMoney(item.totalPrice)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="mt-3 rounded-2xl border border-dashed border-[#dfe8df] bg-[#fcfdfc] p-4 text-center text-xs text-[#667a6d]">
							Đơn đặt chỗ này không thuê thêm thiết bị nào.
						</div>
					)}
				</section>

				{/* Modal Footer with Single Total Display */}
				<div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e0ebe0] pt-4">
					<div>
						<span className="text-xs text-[#667a6d]">Tổng thanh toán: </span>
						<strong className="text-base font-extrabold text-[#164027]">
							{formatBookingMoney(booking.totalAmount)}
						</strong>
					</div>

					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={onClose}>
							<span>Đóng</span>
						</Button>

						{canComplete && onCompleteBooking && (
							<Button
								size="sm"
								onClick={async () => {
									await onCompleteBooking(booking.id);
									onClose();
								}}
								disabled={isCompleting}
								className="gap-1.5 bg-[#164027] text-white hover:bg-[#123420]"
							>
								<CheckCircle className="size-3.5" />
								<span>Hoàn thành đơn đặt chỗ</span>
							</Button>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}
