import {
	Calendar,
	Check,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Copy,
	ExternalLink,
	Mail,
	Package,
	Phone,
	Search,
	User,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import type { BookingPaymentStatus, BookingStatus } from "../../booking-details/types";
import {
	formatBookingDateTime,
	formatBookingMoney,
	formatBookingStatus,
	formatPaymentStatus,
} from "../../booking-details/utils/booking-details-formatters";
import type { TripBookingItem, TripStatus } from "../types";
import { HostBookingDetailModal } from "./HostBookingDetailModal";
import { formatEquipmentCategory } from "./TripRentableEquipment";

export interface HostTripBookingsListProps {
	bookings: TripBookingItem[];
	tripStatus: TripStatus;
	onCompleteBooking?: (bookingId: string) => Promise<void> | void;
	isCompleting?: boolean;
}

type StatusFilter = BookingStatus | "all";

const statusFilterTabs: Array<{ key: StatusFilter; label: string }> = [
	{ key: "all", label: "Tất cả" },
	{ key: "confirmed", label: "Đã xác nhận" },
	{ key: "pending_payment", label: "Chờ thanh toán" },
	{ key: "completed", label: "Đã hoàn thành" },
	{ key: "cancelled", label: "Đã huỷ" },
];

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

export function HostTripBookingsList({
	bookings,
	tripStatus,
	onCompleteBooking,
	isCompleting = false,
}: HostTripBookingsListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<TripBookingItem | null>(
		null
	);

	const toggleExpand = (id: string) => {
		setExpandedBookingIds((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const copyBookingId = (id: string) => {
		if (navigator.clipboard) {
			void navigator.clipboard.writeText(id);
			setCopiedId(id);
			setTimeout(() => setCopiedId(null), 2000);
		}
	};

	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = { all: bookings.length };
		for (const b of bookings) {
			counts[b.status] = (counts[b.status] || 0) + 1;
		}
		return counts;
	}, [bookings]);

	const filteredBookings = useMemo(() => {
		return bookings.filter((b) => {
			const matchesStatus = statusFilter === "all" || b.status === statusFilter;
			if (!matchesStatus) return false;

			if (!searchQuery.trim()) return true;
			const query = searchQuery.trim().toLowerCase();
			const bookerName = b.booker?.fullName?.toLowerCase() || "";
			const bookerEmail = b.booker?.email?.toLowerCase() || "";
			const bookerPhone = b.booker?.phone?.toLowerCase() || "";
			const bookingId = b.id.toLowerCase();

			return (
				bookerName.includes(query) ||
				bookerEmail.includes(query) ||
				bookerPhone.includes(query) ||
				bookingId.includes(query)
			);
		});
	}, [bookings, statusFilter, searchQuery]);

	return (
		<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-xs">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h3 className="text-base font-extrabold text-[#10221b]">Danh sách đơn đặt chỗ</h3>
				</div>

				<div className="text-xs font-semibold text-[#55685a]">
					Tổng cộng: <strong className="font-extrabold text-[#10221b]">{bookings.length}</strong>{" "}
					đơn đặt chỗ
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8fa096]" />
					<input
						type="text"
						placeholder="Tìm theo tên, email, SĐT hoặc mã đơn..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full rounded-xl border border-[#cbd9cd] bg-[#f8faf8] py-2 pl-9 pr-3 text-xs font-medium text-[#10221b] placeholder:text-[#8fa096] focus:border-[#164027] focus:bg-white focus:outline-none"
					/>
				</div>

				<div className="flex flex-wrap gap-1.5" aria-label="Bộ lọc trạng thái đơn đặt chỗ">
					{statusFilterTabs.map((tab) => {
						const count = statusCounts[tab.key] ?? 0;
						if (tab.key !== "all" && count === 0) return null;
						const isActive = statusFilter === tab.key;

						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => setStatusFilter(tab.key)}
								aria-pressed={isActive}
								className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
									isActive
										? "bg-[#164027] text-white shadow-xs"
										: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]"
								}`}
							>
								<span>{tab.label}</span>
								<span
									className={`rounded-full px-1 text-[9px] font-extrabold ${
										isActive ? "bg-white/20 text-white" : "bg-[#dfe8df] text-[#4a5e51]"
									}`}
								>
									{count}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Bookings List */}
			<div className="mt-5 space-y-4">
				{filteredBookings.length === 0 ? (
					<div className="py-10 text-center text-xs text-[#667a6d]">
						Không tìm thấy đơn đặt chỗ nào phù hợp với bộ lọc.
					</div>
				) : (
					filteredBookings.map((booking) => {
						const isExpanded = !!expandedBookingIds[booking.id];
						const hasEquipment = booking.equipmentItems.length > 0;
						const totalEquipmentItems = booking.equipmentItems.reduce(
							(acc, item) => acc + item.quantity,
							0
						);
						const canComplete = tripStatus === "completed" && booking.status === "confirmed";

						return (
							<div
								key={booking.id}
								onClick={() => setSelectedBookingForDetail(booking)}
								className="cursor-pointer rounded-2xl border border-[#dfe8df] bg-[#fcfdfc] p-4.5 transition-all hover:border-[#164027]/50 hover:bg-[#edf5ee]/25 hover:shadow-xs"
							>
								{/* Booking Header */}
								<div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#e7eee7]">
									<div className="flex items-center gap-3">
										<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5ee] font-extrabold text-[#164027]">
											{booking.booker?.fullName ? (
												booking.booker.fullName.charAt(0).toUpperCase()
											) : (
												<User className="size-5" />
											)}
										</div>
										<div>
											<div className="flex items-center gap-2">
												<h4 className="text-sm font-extrabold text-[#10221b]">
													{booking.booker?.fullName || "Khách đặt chỗ"}
												</h4>
												<span
													className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getBookingStatusBadgeClass(
														booking.status
													)}`}
												>
													{formatBookingStatus(booking.status)}
												</span>
												<span
													className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPaymentStatusBadgeClass(
														booking.paymentStatus
													)}`}
												>
													{formatPaymentStatus(booking.paymentStatus)}
												</span>
											</div>

											<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#667a6d]">
												{booking.booker?.email && (
													<span className="inline-flex items-center gap-1">
														<Mail className="size-3 text-[#164027]" />
														{booking.booker.email}
													</span>
												)}
												{booking.booker?.phone && (
													<span className="inline-flex items-center gap-1">
														<Phone className="size-3 text-[#164027]" />
														{booking.booker.phone}
													</span>
												)}
												<span className="inline-flex items-center gap-1">
													<Calendar className="size-3 text-[#164027]" />
													{formatBookingDateTime(booking.createdAt)}
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												setSelectedBookingForDetail(booking);
											}}
											className="inline-flex items-center gap-1 rounded-lg border border-[#164027] bg-[#edf5ee] px-2.5 py-1 text-xs font-bold text-[#164027] hover:bg-[#164027] hover:text-white transition-colors"
										>
											<span>Chi tiết</span>
											<ExternalLink className="size-3" />
										</button>

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												copyBookingId(booking.id);
											}}
											className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] bg-white px-2 py-1 text-[11px] font-mono text-[#55685a] hover:bg-[#f4f7f2]"
											title="Sao chép mã đơn"
										>
											{copiedId === booking.id ? (
												<>
													<Check className="size-3 text-emerald-600" />
													<span>Đã chép</span>
												</>
											) : (
												<>
													<Copy className="size-3" />
													<span>{booking.id.slice(0, 8)}...</span>
												</>
											)}
										</button>
									</div>
								</div>

								{/* Booking Highlights: Capacity, Total & Equipment summary */}
								<div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
									<div className="flex flex-wrap items-center gap-4 text-[#55685a]">
										<span className="inline-flex items-center gap-1.5">
											<Users className="size-4 text-[#164027]" />
											Số người:{" "}
											<strong className="font-extrabold text-[#10221b]">
												{booking.numPeople} người
											</strong>
										</span>

										<span className="inline-flex items-center gap-1.5">
											<Package className="size-4 text-[#164027]" />
											Thiết bị thuê:{" "}
											{hasEquipment ? (
												<strong className="font-extrabold text-[#164027]">
													{totalEquipmentItems} chiếc ({booking.equipmentItems.length} loại)
												</strong>
											) : (
												<span className="text-[#8fa096]">Không thuê thêm</span>
											)}
										</span>
									</div>

									<div className="text-right">
										<span className="text-[11px] text-[#667a6d]">Tổng tiền: </span>
										<strong className="text-sm font-extrabold text-[#164027]">
											{formatBookingMoney(booking.totalAmount)}
										</strong>
									</div>
								</div>

								{/* Hired Equipment Section */}
								{hasEquipment && (
									<div className="mt-3 rounded-xl border border-[#dfe8df] bg-[#edf5ee]/50 p-3">
										<div className="flex items-center gap-1.5 text-xs font-bold text-[#164027]">
											<Package className="size-3.5" />
											<span>Thiết bị đã thuê kèm theo đơn:</span>
										</div>

										<div className="mt-2 divide-y divide-[#dfe8df]">
											{booking.equipmentItems.map((item) => (
												<div
													key={item.id}
													className="flex items-center justify-between py-1.5 text-xs"
												>
													<div className="flex items-center gap-2">
														<span className="font-extrabold text-[#10221b]">{item.name}</span>
														<span className="rounded-full bg-[#dfe8df] px-2 py-0.2 text-[10px] font-semibold text-[#4a5e51]">
															{formatEquipmentCategory(item.category)}
														</span>
													</div>

													<div className="flex items-center gap-4 text-xs">
														<span className="text-[#55685a]">
															Số lượng:{" "}
															<strong className="font-extrabold text-[#164027]">
																x{item.quantity}
															</strong>
														</span>
														<span className="text-[#667a6d]">({item.rentalDays} ngày)</span>
														<strong className="font-bold text-[#10221b]">
															{formatBookingMoney(item.totalPrice)}
														</strong>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Expandable member list & action footer */}
								<div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
									{booking.members && booking.members.length > 0 ? (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												toggleExpand(booking.id);
											}}
											className="inline-flex items-center gap-1 text-[11px] font-bold text-[#164027] hover:underline"
										>
											{isExpanded ? (
												<>
													<ChevronUp className="size-3.5" />
													<span>Thu gọn danh sách thành viên ({booking.members.length})</span>
												</>
											) : (
												<>
													<ChevronDown className="size-3.5" />
													<span>Xem thành viên tham gia ({booking.members.length})</span>
												</>
											)}
										</button>
									) : (
										<div />
									)}

									{canComplete && onCompleteBooking && (
										<Button
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												void onCompleteBooking(booking.id);
											}}
											disabled={isCompleting}
											className="gap-1.5 bg-[#164027] text-white hover:bg-[#123420]"
										>
											<CheckCircle className="size-3.5" />
											<span>Hoàn thành đơn đặt chỗ</span>
										</Button>
									)}
								</div>

								{/* Expanded Member Details */}
								{isExpanded && booking.members && (
									<div className="mt-3 rounded-xl border border-[#e7eee7] bg-white p-3 space-y-1.5">
										<p className="text-[11px] font-bold text-[#55685a]">
											Danh sách thành viên đăng ký:
										</p>
										<div className="divide-y divide-[#f0f4f0]">
											{booking.members.map((member) => (
												<div
													key={member.id}
													className="flex items-center justify-between py-1.5 text-xs"
												>
													<div className="flex items-center gap-2">
														<span className="font-bold text-[#10221b]">
															{member.displayName || member.email || "Khách"}
														</span>
														{member.isPrimary && (
															<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">
																Người đặt chính
															</span>
														)}
													</div>
													{member.email && (
														<span className="text-[11px] text-[#667a6d]">{member.email}</span>
													)}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>

			{/* Booking Detail Modal */}
			<HostBookingDetailModal
				isOpen={!!selectedBookingForDetail}
				booking={selectedBookingForDetail}
				tripStatus={tripStatus}
				onClose={() => setSelectedBookingForDetail(null)}
				onCompleteBooking={onCompleteBooking}
				isCompleting={isCompleting}
			/>
		</div>
	);
}
