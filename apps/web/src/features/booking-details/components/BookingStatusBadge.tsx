import type { BookingPaymentStatus, BookingStatus } from "../types";
import { formatBookingStatus, formatPaymentStatus } from "../utils/booking-details-formatters";

const BOOKING_STATUS_CLASSES: Record<BookingStatus, string> = {
	pending_payment: "bg-amber-100 text-amber-900",
	pending_reconfirmation: "bg-amber-100 text-amber-900",
	confirmed: "bg-emerald-100 text-emerald-900",
	cancelled: "bg-slate-100 text-slate-700",
	expired: "bg-slate-100 text-slate-700",
	completed: "bg-sky-100 text-sky-900",
};

const PAYMENT_STATUS_CLASSES: Record<BookingPaymentStatus, string> = {
	not_required: "bg-slate-100 text-slate-700",
	unpaid: "bg-amber-100 text-amber-900",
	paid: "bg-emerald-100 text-emerald-900",
};

const BADGE_BASE_CLASSES = "inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold";
const UNKNOWN_STATUS_CLASSES = "bg-slate-100 text-slate-700";

export function BookingStatusBadge({
	status,
	prefix,
	testId,
}: {
	status: BookingStatus | null;
	prefix?: string;
	testId?: string;
}) {
	const statusClasses = status ? BOOKING_STATUS_CLASSES[status] : UNKNOWN_STATUS_CLASSES;

	return (
		<span data-testid={testId} className={`${BADGE_BASE_CLASSES} ${statusClasses}`}>
			{prefix}
			{formatBookingStatus(status)}
		</span>
	);
}

export function PaymentStatusBadge({
	status,
	prefix,
	testId,
}: {
	status: BookingPaymentStatus | null;
	prefix?: string;
	testId?: string;
}) {
	const statusClasses = status ? PAYMENT_STATUS_CLASSES[status] : UNKNOWN_STATUS_CLASSES;

	return (
		<span data-testid={testId} className={`${BADGE_BASE_CLASSES} ${statusClasses}`}>
			{prefix}
			{formatPaymentStatus(status)}
		</span>
	);
}
