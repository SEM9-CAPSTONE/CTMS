import type React from "react";
import { Card } from "../../../shared/components";
import type { PerformanceReportData } from "../types";

interface PerformanceMetricsCardsProps {
	data: PerformanceReportData;
}

function formatVnd(value: number): string {
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export const PerformanceMetricsCards: React.FC<PerformanceMetricsCardsProps> = ({ data }) => {
	const { bookings, trips, revenue, scope } = data;
	const isAdmin = scope?.role === "admin";

	const actualPlatformFee = revenue.platformFeeActual ?? Math.round(revenue.actual.amount * 0.05);
	const actualGmv = revenue.gmvActual ?? revenue.actual.amount;

	const estimatedGmv = revenue.gmvEstimated ?? revenue.estimated.amount;
	const estimatedPlatformFee = revenue.platformFeeEstimated ?? Math.round(estimatedGmv * 0.05);

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{/* Tổng đơn đặt chỗ */}
			<Card className="flex min-h-[115px] flex-col justify-between p-5">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
						Đơn đặt chỗ
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-gray-900">{bookings.total}</span>
						<span className="text-xs text-gray-500">lượt</span>
					</div>
				</div>
				<div className="mt-2 text-xs text-gray-600">
					<span>Thành công: </span>
					<span className="font-semibold text-emerald-600">
						{bookings.confirmed + bookings.completed}
					</span>
					<span className="text-gray-400"> • </span>
					<span>Hủy: </span>
					<span className="font-semibold text-rose-500">{bookings.cancelled}</span>
				</div>
			</Card>

			{/* Tổng chuyến đi */}
			<Card className="flex min-h-[115px] flex-col justify-between p-5">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
						Chuyến đi
					</div>
					<div className="mt-3 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-gray-900">{trips.total}</span>
						<span className="text-xs text-gray-500">chuyến</span>
					</div>
				</div>
				<div className="mt-2 text-xs text-gray-600">
					<span>Hoàn tất: </span>
					<span className="font-semibold text-gray-800">{trips.completed}</span>
					<span className="text-gray-400"> • </span>
					<span>Mở đặt: </span>
					<span className="font-semibold text-blue-600">{trips.published}</span>
				</div>
			</Card>

			{/* Thẻ 3: Hoa hồng thực thu (5%) với Admin / Doanh thu thực tế với Host */}
			<Card className="flex min-h-[115px] flex-col justify-between border-emerald-200 bg-emerald-50/40 p-5">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
						{isAdmin ? "Hoa hồng thực thu (5%)" : "Doanh thu thực tế"}
					</div>
					<div className="mt-3 truncate text-2xl font-extrabold text-emerald-950 whitespace-nowrap">
						{formatVnd(isAdmin ? actualPlatformFee : revenue.actual.amount)}
					</div>
				</div>
				<div className="mt-2 text-xs font-medium text-emerald-700/80">
					{isAdmin ? `Từ ${formatVnd(actualGmv)} đã quyết toán` : "Từ các chuyến đã quyết toán"}
				</div>
			</Card>

			{/* Thẻ 4: Tiền đang tạm giữ với Admin / Doanh thu dự kiến với Host */}
			<Card className="flex min-h-[115px] flex-col justify-between border-amber-200 bg-amber-50/30 p-5">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
						{isAdmin ? "Tiền đang tạm giữ" : "Doanh thu dự kiến"}
					</div>
					<div className="mt-3 truncate text-2xl font-bold text-amber-950 whitespace-nowrap">
						{formatVnd(isAdmin ? estimatedGmv : revenue.estimated.amount)}
					</div>
				</div>
				<div className="mt-2 text-xs font-medium text-amber-700/80">
					{isAdmin
						? `Hoa hồng dự kiến: ${formatVnd(estimatedPlatformFee)}`
						: "Từ đơn đặt đã xác nhận & giữ chỗ"}
				</div>
			</Card>
		</div>
	);
};
