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
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900">
					<StatusBadge tone="warning">Mẫu dữ liệu nhỏ</StatusBadge>
					<span>
						Kỳ đang xem có ít hơn 5 chuyến hoàn thành hoặc ít hơn 20 đơn đặt chỗ. Các tỷ lệ chỉ mang
						tính tham khảo.
					</span>
				</div>
			)}

			{/* Nhóm 1: Chỉ số tài chính (CTMS-110) */}
			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8efe8] pb-3">
					<h2 className="text-base font-semibold text-[#10221b]">Hiệu quả tài chính</h2>
					<span className="text-xs text-[#526357]">
						Ghi nhận theo ngày thanh toán, quyết toán và chi trả (giờ Việt Nam)
					</span>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Doanh thu gộp</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{formatVnd(kpis.grossRevenue)}
						</p>
						<p className="text-xs text-[#647468]">
							Hoàn tiền trong kỳ: {formatVnd(kpis.refundAmount)}
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Phần Host thực nhận</p>
						<p className="text-2xl font-bold tracking-tight text-[#164027]">
							{formatVnd(kpis.netRevenue)}
						</p>
						<p className="text-xs text-[#647468]">
							Phí nền tảng: {formatVnd(kpis.platformFee)}
							{kpis.postSettlementRefund > 0
								? ` · Điều chỉnh sau quyết toán: ${formatVnd(kpis.postSettlementRefund)}`
								: ""}
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Đã chi trả về ví</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{kpis.payout === null ? "Không tách theo khu vực" : formatVnd(kpis.payout)}
						</p>
						<p className="text-xs text-[#647468]">Tiền đang tạm giữ: {formatVnd(kpis.heldFunds)}</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Lợi nhuận ước tính</p>
						<p className="text-lg font-semibold text-[#526357]">
							{profitStatus === "insufficient_data" ? "Chưa đủ dữ liệu chi phí" : "—"}
						</p>
						<p className="text-xs text-[#647468]">Hệ thống chưa lưu chi phí tổ chức chuyến đi</p>
					</div>
				</div>
			</Card>

			{/* Nhóm 2: Chỉ số vận hành (chuyến đã hoàn thành theo ngày khởi hành) */}
			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8efe8] pb-3">
					<h2 className="text-base font-semibold text-[#10221b]">Hiệu quả vận hành</h2>
					<span className="text-xs text-[#526357]">
						Tính trên {operations.completedTripCount} chuyến đã hoàn thành theo ngày khởi hành (giờ
						Việt Nam)
					</span>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Tỷ lệ lấp đầy</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.fillRate === null ? "Chưa có dữ liệu" : `${operations.fillRate}%`}
						</p>
						<p className="text-xs text-[#647468]">
							Tính trên {operations.includedFillTripCount} chuyến đủ sức chứa tối đa
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Tổng lượt khách</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.totalGuests === null
								? "Chưa có dữ liệu"
								: `${operations.totalGuests.toLocaleString("vi-VN")} khách`}
						</p>
						<p className="text-xs text-[#647468]">
							Tổng số khách từ các đơn đã xác nhận và hoàn thành
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Tỷ lệ hủy đặt chỗ</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{operations.cancellationRate === null
								? "Chưa có dữ liệu"
								: `${operations.cancellationRate}%`}
						</p>
						<p className="text-xs text-[#647468]">
							Chuyến đã hủy trong kỳ: {operations.cancelledTrips.count} chuyến
						</p>
					</div>

					<div className="space-y-1">
						<p className="text-xs font-medium tracking-wide text-[#526357]">Đặt trước trung vị</p>
						<p className="text-2xl font-bold tracking-tight text-[#10221b]">
							{leadTime.medianDays === null ? "Chưa có dữ liệu" : `${leadTime.medianDays} ngày`}
						</p>
						<p className="text-xs text-[#647468]">
							{leadTime.averageDays !== null
								? `Trung bình ${leadTime.averageDays} ngày (${leadTime.sampleSize} đơn)`
								: "Chưa đủ mẫu đơn đặt hợp lệ"}
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
