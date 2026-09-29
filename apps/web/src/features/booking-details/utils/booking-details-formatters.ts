import type { BookingMemberStatus, BookingPaymentStatus, BookingStatus } from "../types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
	style: "currency",
	currency: "VND",
	maximumFractionDigits: 0,
});

export function formatBookingMoney(value: string | null): string {
	if (value === null) return "Chưa cập nhật";
	if (!/^\d+(\.\d{1,2})?$/.test(value)) return value;
	const amount = Number(value);
	return Number.isFinite(amount) ? currencyFormatter.format(amount) : value;
}

export function formatBookingDateTime(value: string | null): string {
	if (!value) return "Chưa cập nhật";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

const bookingStatusLabels: Record<BookingStatus, string> = {
	pending_payment: "Chờ thanh toán",
	confirmed: "Đã xác nhận",
	cancelled: "Đã hủy",
	expired: "Đã hết hạn",
	completed: "Đã hoàn thành",
};

const paymentStatusLabels: Record<BookingPaymentStatus, string> = {
	not_required: "Không yêu cầu thanh toán",
	unpaid: "Chưa thanh toán",
	paid: "Đã thanh toán",
};

const memberStatusLabels: Record<BookingMemberStatus, string> = {
	registered: "Đã đăng ký",
	removed: "Đã xóa",
	joined: "Đã tham gia",
	no_show: "Không tham gia",
	left: "Đã rời chuyến",
};

export function formatBookingStatus(value: BookingStatus | null): string {
	return value ? bookingStatusLabels[value] : "Chưa cập nhật";
}

export function formatPaymentStatus(value: BookingPaymentStatus | null): string {
	return value ? paymentStatusLabels[value] : "Chưa cập nhật";
}

export function formatMemberStatus(value: BookingMemberStatus): string {
	return memberStatusLabels[value];
}
