import { AlertCircle, RefreshCw, Scale } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { AdminWeatherPenaltyDialog } from "../components/AdminWeatherPenaltyDialog";
import { useAdminWeatherPenalties } from "../hooks/useWeatherPenalties";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { AdminPenaltyFilter, WeatherPenalty } from "../types";
import {
	WEATHER_PENALTY_STATUS_LABELS,
	WEATHER_PENALTY_STATUS_TONES,
	formatPenaltyDate,
	isReviewOverdue,
	penaltyDisplayStatus,
	weatherPenaltyErrorMessage,
} from "../utils/weather-penalty-labels";

const FILTERS: Array<{ key: AdminPenaltyFilter; label: string }> = [
	{ key: "waiver_pending", label: "Chờ duyệt miễn" },
	{ key: "applied", label: "Đang áp dụng" },
	{ key: "waived", label: "Đã miễn" },
	{ key: "all", label: "Tất cả" },
];

const EMPTY_TEXT: Record<AdminPenaltyFilter, string> = {
	waiver_pending: "Không có yêu cầu miễn phạt nào đang chờ duyệt.",
	applied: "Không có khoản phạt nào đang áp dụng.",
	waived: "Chưa có khoản phạt nào được miễn.",
	all: "Chưa có khoản phạt thời tiết nào.",
};

export interface AdminWeatherPenaltiesPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
	service?: typeof weatherPenaltiesService;
}

/** Policy §6: Host weather penalties and their force-majeure waiver requests. */
export function AdminWeatherPenaltiesPage({ onLogout, service }: AdminWeatherPenaltiesPageProps) {
	const [filter, setFilter] = useState<AdminPenaltyFilter>("waiver_pending");
	const query = useAdminWeatherPenalties(filter, { service });
	const [selected, setSelected] = useState<WeatherPenalty | null>(null);
	const items = query.data ?? [];

	return (
		<AdminLayout activeItem="weather-penalties" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<Scale className="size-7 text-[#164027]" /> Phạt thời tiết
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Host bị phạt khi Admin phải quyết định thay sau mốc 24 giờ trước giờ đi. Duyệt các yêu
							cầu miễn phạt vì bất khả kháng trong 5 ngày làm việc.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void query.refetch()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<RefreshCw className="size-4" /> Làm mới
					</button>
				</div>

				<div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc khoản phạt">
					{FILTERS.map((option) => (
						<button
							key={option.key}
							type="button"
							role="tab"
							aria-selected={filter === option.key}
							onClick={() => setFilter(option.key)}
							className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
								filter === option.key
									? "bg-[#164027] text-white"
									: "border border-[#dfe8df] bg-white text-[#164027] hover:bg-[#f1f5f0]"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>

				{query.isError && (
					<div
						role="alert"
						className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<AlertCircle className="size-5 shrink-0" />
						{weatherPenaltyErrorMessage(query.error)}
					</div>
				)}
				{query.isPending && <p className="text-sm text-[#667a6d]">Đang tải danh sách...</p>}
				{query.isSuccess && items.length === 0 && (
					<p className="rounded-2xl border border-[#dfe8df] bg-white p-6 text-sm text-[#667a6d]">
						{EMPTY_TEXT[filter]}
					</p>
				)}

				{items.length > 0 && (
					<ul className="space-y-3" aria-label="Khoản phạt thời tiết">
						{items.map((item) => {
							const status = penaltyDisplayStatus(item);
							return (
								<li key={item.id}>
									<button
										type="button"
										data-testid="weather-penalty-row"
										onClick={() => setSelected(item)}
										className="flex w-full flex-col gap-2 rounded-2xl border border-[#dfe8df] bg-white p-4 text-left shadow-sm transition hover:border-[#164027] sm:flex-row sm:items-center sm:justify-between"
									>
										<div>
											<p className="font-extrabold text-[#10221b]">{item.tripTitle}</p>
											<p className="mt-1 text-xs text-[#667a6d]">
												Host {item.hostName ?? item.hostId} · Vi phạm lần {item.violationNumber} ·
												Phạt {formatBookingMoney(item.amount)} · Còn phải trừ{" "}
												{formatBookingMoney(item.outstandingAmount)}
												{item.waiver.reviewDueAt && !item.waiver.decision
													? ` · Hạn xem xét ${formatPenaltyDate(item.waiver.reviewDueAt)}`
													: ""}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											{isReviewOverdue(item) && (
												<StatusBadge tone="danger">Quá hạn xem xét</StatusBadge>
											)}
											<StatusBadge tone={WEATHER_PENALTY_STATUS_TONES[status]}>
												{WEATHER_PENALTY_STATUS_LABELS[status]}
											</StatusBadge>
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
			{selected && (
				<AdminWeatherPenaltyDialog
					key={selected.id}
					penalty={selected}
					onClose={() => setSelected(null)}
					service={service}
				/>
			)}
		</AdminLayout>
	);
}
