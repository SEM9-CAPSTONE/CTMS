import { Card, StatusBadge } from "../../../shared/components";
import type { HostAnalyticsResponse } from "../types";

export interface HostAnalyticsKpiGroupsProps {
	data: HostAnalyticsResponse;
}

export function HostAnalyticsKpiGroups({ data }: HostAnalyticsKpiGroupsProps) {
	const { operations, leadTime, smallSample } = data;

	return (
		<div className="flex flex-col gap-3">
			{smallSample && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
					<StatusBadge tone="warning">Mẫu dữ liệu nhỏ</StatusBadge>
					<span>Số liệu dưới 5 chuyến hoặc 20 đơn chỉ mang tính tham khảo.</span>
				</div>
			)}

			<section aria-labelledby="host-operations-kpis" className="flex flex-col gap-2.5">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 id="host-operations-kpis" className="text-sm font-bold text-gray-900">
						Hiệu quả vận hành
					</h2>
					<span className="text-xs text-[#647468]">
						{operations.completedTripCount} chuyến hoàn thành · theo ngày khởi hành
					</span>
				</div>

				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<Card className="flex min-h-[96px] flex-col justify-between p-4">
						<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
							Tỷ lệ kín chỗ
						</div>
						<div className="mt-2 text-2xl font-bold text-gray-900">
							{operations.fillRate === null ? "—" : `${Math.round(operations.fillRate)}%`}
						</div>
					</Card>

					<Card className="flex min-h-[96px] flex-col justify-between p-4">
						<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
							Tổng lượt khách
						</div>
						<div className="mt-2 flex items-baseline gap-1.5">
							<span className="text-2xl font-bold text-gray-900">
								{operations.totalGuests === null
									? "—"
									: operations.totalGuests.toLocaleString("vi-VN")}
							</span>
							{operations.totalGuests !== null && (
								<span className="text-xs text-gray-500">khách</span>
							)}
						</div>
					</Card>

					<Card className="flex min-h-[96px] flex-col justify-between p-4">
						<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
							Tỷ lệ hủy đơn
						</div>
						<div className="mt-2 text-2xl font-bold text-gray-900">
							{operations.cancellationRate === null
								? "—"
								: `${Math.round(operations.cancellationRate)}%`}
						</div>
					</Card>

					<Card className="flex min-h-[96px] flex-col justify-between p-4">
						<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
							Khách đặt trước
						</div>
						<div className="mt-2 flex items-baseline gap-1.5">
							<span className="text-2xl font-bold text-gray-900">
								{leadTime.medianDays === null ? "—" : `~${Math.round(leadTime.medianDays)}`}
							</span>
							{leadTime.medianDays !== null && <span className="text-xs text-gray-500">ngày</span>}
						</div>
					</Card>
				</div>
			</section>
		</div>
	);
}
