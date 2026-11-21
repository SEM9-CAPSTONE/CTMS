import type React from "react";
import { Card } from "../../../shared/components";
import { formatVnd } from "../../../shared/utils/money";
import { DATE_BASIS_HINTS } from "../constants";
import type { RevenueKpis } from "../types";

const NOT_BY_AREA = "Không tách theo khu vực";

interface KpiCardProps {
	label: string;
	value: number | null;
	/** BR-326 date basis, exposed as the card's tooltip. */
	hint: string;
	meta?: string;
	emphasis?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, meta, emphasis }) => (
	<div title={hint}>
		<Card
			className={`flex min-h-[115px] flex-col justify-between p-5 ${
				emphasis ? "border-emerald-200 bg-emerald-50/40" : ""
			}`}
		>
			<div>
				<div
					className={`text-xs font-semibold uppercase tracking-wider ${
						emphasis ? "text-emerald-800" : "text-gray-500"
					}`}
				>
					{label}
				</div>
				{value === null ? (
					<div className="mt-3 text-sm font-semibold text-gray-500">{NOT_BY_AREA}</div>
				) : (
					<div
						className={`mt-3 truncate text-2xl font-bold whitespace-nowrap ${
							emphasis ? "text-emerald-950" : "text-gray-900"
						}`}
					>
						{formatVnd(value)}
					</div>
				)}
			</div>
			{meta && <div className="mt-2 text-xs text-gray-600">{meta}</div>}
		</Card>
	</div>
);

interface RevenueKpiCardsProps {
	kpis: RevenueKpis;
}

/** BR-325. Recorded money and money still waiting are shown as two separate groups. */
export const RevenueKpiCards: React.FC<RevenueKpiCardsProps> = ({ kpis }) => (
	<div className="flex flex-col gap-6">
		<section aria-labelledby="revenue-recorded-heading" className="flex flex-col gap-3">
			<h3 id="revenue-recorded-heading" className="text-sm font-bold text-gray-900">
				Đã ghi nhận
			</h3>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<KpiCard
					label="Tổng tiền khách trả"
					value={kpis.grossRevenue}
					hint={DATE_BASIS_HINTS.grossRevenue}
				/>
				<KpiCard
					label="Tiền đã hoàn"
					value={kpis.refundAmount}
					hint={DATE_BASIS_HINTS.refundAmount}
				/>
				<KpiCard
					label="Phí nền tảng"
					value={kpis.platformFee}
					hint={DATE_BASIS_HINTS.platformFee}
				/>
				<KpiCard
					label="Thu nhập sau phí"
					value={kpis.netRevenue}
					hint={DATE_BASIS_HINTS.netRevenue}
					emphasis
					meta={
						kpis.postSettlementRefund > 0
							? `Đã trừ ${formatVnd(kpis.postSettlementRefund)} hoàn sau quyết toán`
							: undefined
					}
				/>
				<KpiCard label="Đã rút về ngân hàng" value={kpis.payout} hint={DATE_BASIS_HINTS.payout} />
			</div>
		</section>

		<section aria-labelledby="revenue-pending-heading" className="flex flex-col gap-3">
			<h3 id="revenue-pending-heading" className="text-sm font-bold text-gray-900">
				Đang chờ xử lý
			</h3>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<KpiCard
					label="Tiền chưa quyết toán"
					value={kpis.heldFunds}
					hint={DATE_BASIS_HINTS.heldFunds}
				/>
				<KpiCard
					label="Yêu cầu rút đang xử lý"
					value={kpis.pendingPayout}
					hint={DATE_BASIS_HINTS.pendingPayout}
				/>
				<KpiCard
					label="Hoàn tiền đang xử lý"
					value={kpis.pendingRefundAmount}
					hint={DATE_BASIS_HINTS.pendingRefund}
					meta={kpis.pendingRefundCount > 0 ? `${kpis.pendingRefundCount} yêu cầu` : undefined}
				/>
			</div>
		</section>
	</div>
);
