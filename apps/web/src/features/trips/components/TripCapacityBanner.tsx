import { AlertCircle, AlertTriangle, Clock } from "lucide-react";
import type { TripStatus } from "../types";

export interface TripCapacityBannerProps {
	remainingSeats: number | null;
	bookingDeadline: string;
	isBookable: boolean;
	status?: TripStatus;
}

export function TripCapacityBanner({
	remainingSeats,
	bookingDeadline,
	isBookable,
}: TripCapacityBannerProps) {
	// Condition 1: Sold out or non-bookable
	if (!isBookable || remainingSeats === 0) {
		return (
			<div
				data-testid="trip-capacity-banner-sold-out"
				className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 shadow-xs"
			>
				<AlertCircle className="size-5 shrink-0 text-rose-600" />
				<div>
					<p className="font-extrabold text-rose-900">Đã hết chỗ</p>
					<p className="mt-0.5 text-rose-700">
						Chuyến đi đã đạt đủ số lượng người tham gia hoặc đã tạm dừng nhận đăng ký mới để đảm bảo
						an toàn.
					</p>
				</div>
			</div>
		);
	}

	// Condition 2: Low remaining seats (<= 3)
	if (remainingSeats !== null && remainingSeats > 0 && remainingSeats <= 3) {
		return (
			<div
				data-testid="trip-capacity-banner-low-seats"
				className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs"
			>
				<AlertTriangle className="size-5 shrink-0 text-amber-600" />
				<div>
					<p className="font-extrabold text-amber-900">Chỉ còn {remainingSeats} chỗ cuối cùng!</p>
					<p className="mt-0.5 text-amber-700">
						Số lượng chỗ có hạn và có thể được đặt bất cứ lúc nào. Hãy hoàn tất đặt chỗ sớm để giữ
						chỗ.
					</p>
				</div>
			</div>
		);
	}

	// Condition 3: Deadline approaching within 24 hours
	const deadlineTime = new Date(bookingDeadline).getTime();
	const now = Date.now();
	const hoursLeft = (deadlineTime - now) / (1000 * 60 * 60);

	if (hoursLeft > 0 && hoursLeft <= 24) {
		const hoursCeil = Math.max(1, Math.ceil(hoursLeft));
		return (
			<div
				data-testid="trip-capacity-banner-deadline"
				className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 shadow-xs"
			>
				<Clock className="size-5 shrink-0 text-sky-600" />
				<div>
					<p className="font-extrabold text-sky-900">Sắp hết hạn đặt vé</p>
					<p className="mt-0.5 text-sky-700">
						Thời hạn chốt danh sách đăng ký sẽ kết thúc trong vòng khoảng {hoursCeil} giờ tới.
					</p>
				</div>
			</div>
		);
	}

	return null;
}
