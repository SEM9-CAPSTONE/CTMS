import { Card, StatusBadge } from "../../../shared/components";
import { formatVnd } from "../constants";
import type { HostAnalyticsResponse } from "../types";

export interface HostAnalyticsKpiGroupsProps {
	data: HostAnalyticsResponse;
}

export function HostAnalyticsKpiGroups({ data }: HostAnalyticsKpiGroupsProps) {
	const { financial, operations, leadTime, smallSample, profitStatus } = data;
	const kpis = financial.kpis;

	return (
		<div className="space-y-4">
			{smallSample && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs text-amber-900">
					<StatusBadge tone="warning">Mẫu dữ liệu nhỏ</StatusBadge>
					<span>Ít hơn 5 chuyến hoặc 20 đơn — chỉ mang tính tham khảo.</span>
				</div>
			)}

			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8efe8] pb-2.5">
					<h2 className="text-base font-semibold text-[#10221b]">Hiệu quả tài chính</h2>
					<span className="text-xs text-[#647468]">Theo ngày thanh toán & quyết toán</span>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Doanh thu gộp</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{formatVnd(kpis.grossRevenue)}
						</p>
						<p className="text-xs text-[#647468]">Hoàn: {formatVnd(kpis.refundAmount)}</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Phần Host thực nhận</p>
						<p className="text-2xl font-bold tracking-tight text-[#164027]">
							{formatVnd(kpis.netRevenue)}
						</p>
						<p className="text-xs text-[#647468]">Phí: {formatVnd(kpis.platformFee)}</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Đã chi trả về ví</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{kpis.payout === null ? "Không tách theo khu vực" : formatVnd(kpis.payout)}
						</p>
						<p className="text-xs text-[#647468]">Tạm giữ: {formatVnd(kpis.heldFunds)}</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Lợi nhuận</p>
						<p className="text-base font-semibold text-[#526357]">
							{profitStatus === "insufficient_data" ? "Chưa đủ dữ liệu chi phí" : "—"}
						</p>
					</div>
				</div>
			</Card>

			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8efe8] pb-2.5">
					<h2 className="text-base font-semibold text-[#10221b]">Hiệu quả vận hành</h2>
					<span className="text-xs text-[#647468]">
						{operations.completedTripCount} chuyến hoàn thành · theo ngày khởi hành
					</span>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Tỷ lệ lấp đầy</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.fillRate === null ? "Chưa có dữ liệu" : `${operations.fillRate}%`}
						</p>
						<p className="text-xs text-[#647468]">
							{operations.includedFillTripCount} chuyến đủ sức chứa
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Tổng lượt khách</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.totalGuests === null
								? "Chưa có dữ liệu"
								: `${operations.totalGuests.toLocaleString("vi-VN")} khách`}
						</p>
						<p className="text-xs text-[#647468]">Đơn đã xác nhận & hoàn thành</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Tỷ lệ hủy đặt chỗ</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.cancellationRate === null
								? "Chưa có dữ liệu"
								: `${operations.cancellationRate}%`}
						</p>
						<p className="text-xs text-[#647468]">Hủy chuyến: {operations.cancelledTrips.count}</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium text-[#526357]">Đặt trước trung vị</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{leadTime.medianDays === null ? "Chưa có dữ liệu" : `${leadTime.medianDays} ngày`}
						</p>
						<p className="text-xs text-[#647468]">
							{leadTime.averageDays !== null
								? `TB ${leadTime.averageDays} ngày · ${leadTime.sampleSize} đơn`
								: "Chưa đủ mẫu"}
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
