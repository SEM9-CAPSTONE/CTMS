import { ArrowRight, CloudSun, Sparkles } from "lucide-react";
import { Button, Card, StatusBadge } from "../../../shared/components";
import {
	TRIP_TYPE_LABELS,
	formatMonthVi,
	formatShortDateVi,
	formatSuggestedPrice,
} from "../constants";
import type {
	ActiveSuggestionJobConflict,
	HostSuggestionHistoryItem,
	HostSuggestionJobResponse,
	SuggestionWeatherSummary,
} from "../types";

export interface HostSuggestionsSectionProps {
	job: HostSuggestionJobResponse | null;
	history: HostSuggestionHistoryItem[];
	leadTimeMedianDays: number | null;
	isLoading: boolean;
	isPolling: boolean;
	isCreating: boolean;
	waitSeconds: number;
	activeConflict: ActiveSuggestionJobConflict | null;
	quickCreateBusyId: string | null;
	onCreateJob: () => void;
	onInspectConflictJob: (jobId: string) => void;
	onQuickCreate: (suggestionId: string) => void;
}

function weatherBadgeTone(
	weather: SuggestionWeatherSummary
): "success" | "warning" | "danger" | "neutral" {
	if (weather.status !== "available") return "neutral";
	if (weather.riskLevel === "red") return "danger";
	if (weather.riskLevel === "yellow") return "warning";
	return "success";
}

function weatherBadgeLabel(weather: SuggestionWeatherSummary): string {
	if (weather.status === "beyond_horizon") return "Chưa có dự báo cho thời điểm này";
	if (weather.status === "unavailable") return "Tạm thiếu dự báo";
	if (weather.riskLevel === "red") return "Rủi ro cao";
	if (weather.riskLevel === "yellow") return "Cần lưu ý";
	return "Thời tiết thuận lợi";
}

function cleanWeatherDetail(weather: SuggestionWeatherSummary): string | null {
	if (weather.status !== "available") return null;
	return weather.summary.replace(/^[^:]+:\s*/, "").trim();
}

export function HostSuggestionsSection({
	job,
	history,
	leadTimeMedianDays,
	isLoading,
	isPolling,
	isCreating,
	waitSeconds,
	activeConflict,
	quickCreateBusyId,
	onCreateJob,
	onInspectConflictJob,
	onQuickCreate,
}: HostSuggestionsSectionProps) {
	const buttonDisabled = isCreating || isPolling || waitSeconds > 0;

	const visibleSuggestions = job?.suggestions.slice(0, 3) ?? [];

	return (
		<Card className="space-y-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8efe8] pb-3.5">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-base font-bold text-gray-900">Gợi ý tổ chức chuyến đi</h2>
						<StatusBadge tone="info">Tham khảo</StatusBadge>
						{job?.stale && <StatusBadge tone="warning">Dữ liệu đã thay đổi</StatusBadge>}
					</div>
					{leadTimeMedianDays !== null && (
						<p className="mt-0.5 text-xs text-gray-500">
							Khách thường đặt trước khoảng{" "}
							<strong className="font-semibold text-gray-700">
								{Math.round(leadTimeMedianDays)} ngày
							</strong>
						</p>
					)}
				</div>

				<Button
					variant="primary"
					size="sm"
					onClick={onCreateJob}
					disabled={buttonDisabled}
					aria-busy={isCreating || isPolling}
					className="min-h-9 rounded-xl"
				>
					<Sparkles className="size-4" aria-hidden="true" />
					<span>
						{waitSeconds > 0
							? `Chờ ${waitSeconds} giây`
							: isCreating || isPolling
								? "Đang tổng hợp gợi ý..."
								: "Tạo gợi ý chuyến đi"}
					</span>
				</Button>
			</div>

			{activeConflict && (
				<output className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
					<div>
						<p className="font-semibold">
							Đang có một yêu cầu tạo gợi ý khác đang chạy với bộ lọc khác
						</p>
						<p>
							{formatShortDateVi(activeConflict.periodFrom)} –{" "}
							{formatShortDateVi(activeConflict.periodTo)} ·{" "}
							{activeConflict.areaCode ?? "Tất cả khu vực"}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onInspectConflictJob(activeConflict.id)}
					>
						Xem yêu cầu đang chạy
					</Button>
				</output>
			)}

			{isLoading ? (
				<p className="py-6 text-center text-sm text-gray-500">Đang tải gợi ý gần nhất...</p>
			) : isPolling ? (
				<div
					aria-live="polite"
					className="rounded-xl bg-[#f4f8f4] px-4 py-6 text-center text-sm text-[#2c4234]"
				>
					Đang tổng hợp gợi ý từ lịch sử và dự báo thời tiết...
				</div>
			) : job?.status === "failed" ? (
				<div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-xs text-rose-900">
					Dịch vụ phân tích tạm gián đoạn. Lượt tạo trong ngày đã được hoàn lại.
				</div>
			) : visibleSuggestions.length === 0 ? (
				<p className="py-6 text-center text-sm text-gray-500">
					Chưa có gợi ý nào. Bấm “Tạo gợi ý chuyến đi” để nhận đề xuất phù hợp.
				</p>
			) : (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					{visibleSuggestions.map((item) => {
						const busy = quickCreateBusyId === item.id;
						const hasAiNarrative = Boolean(
							item.aiSeasonNote || (item.aiRisks && item.aiRisks.length > 0)
						);
						const weatherDetail = item.weatherSummary
							? cleanWeatherDetail(item.weatherSummary)
							: null;

						return (
							<div
								key={item.id}
								className="flex flex-col justify-between gap-3 rounded-xl border border-[#e3ece3] bg-[#fafcfa] p-4"
							>
								<div className="space-y-2.5">
									{/* Hàng 1: Tháng + Loại chuyến + Ngày dự kiến */}
									<div className="flex flex-wrap items-center justify-between gap-1.5">
										<div className="flex flex-wrap items-center gap-1.5">
											<StatusBadge tone="success">{formatMonthVi(item.monthHint)}</StatusBadge>
											<StatusBadge tone="neutral">{TRIP_TYPE_LABELS[item.tripType]}</StatusBadge>
										</div>
										{item.suggestedStartsAt && (
											<span className="text-xs font-semibold text-[#164027]">
												{formatShortDateVi(item.suggestedStartsAt)}
											</span>
										)}
									</div>

									{/* Hàng 2: Tên tuyến */}
									<h3 className="text-sm font-bold text-gray-900">
										{item.routeName || "Tuyến trekking của bạn"}
									</h3>

									{/* Hàng 3: Từ dữ liệu của bạn (gọn 1 dòng + 1 tag lý do chính) */}
									<div className="space-y-1 text-xs text-gray-600">
										<div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
											<span className="sr-only">Từ dữ liệu của bạn</span>
											<span>{item.areaName || "Chưa gắn khu vực"}</span>
											<span className="text-gray-300">·</span>
											<span className="font-semibold text-gray-900">
												{formatSuggestedPrice(item.suggestedPricePerPerson)}
											</span>
											{item.suggestedCapacityMin !== null && (
												<>
													<span className="text-gray-300">·</span>
													<span>Từ {item.suggestedCapacityMin} khách</span>
												</>
											)}
										</div>
										{item.rationaleLabels[0] && (
											<p className="text-[11px] text-gray-500">{item.rationaleLabels[0]}</p>
										)}
									</div>

									{/* Hàng 4: Thời tiết Open-Meteo (không lặp chữ) */}
									{item.weatherSummary && (
										<div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-gray-700">
											<CloudSun className="size-3.5 shrink-0 text-[#164027]" aria-hidden="true" />
											<StatusBadge tone={weatherBadgeTone(item.weatherSummary)}>
												{weatherBadgeLabel(item.weatherSummary)}
											</StatusBadge>
											{weatherDetail && <span className="text-gray-600">{weatherDetail}</span>}
										</div>
									)}

									{/* Hàng 5: Nhận định của AI (thu gọn vào details, bấm mới mở) */}
									{hasAiNarrative && (
										<details className="group pt-0.5 text-xs">
											<summary className="cursor-pointer font-medium text-[#164027] hover:underline">
												<span>Góc nhìn mùa vụ từ AI (tham khảo)</span>
											</summary>
											<div className="mt-1.5 space-y-1 border-l-2 border-[#164027]/35 pl-2.5 text-gray-700">
												{item.aiSeasonNote && (
													<p className="leading-relaxed">{item.aiSeasonNote}</p>
												)}
												{item.aiRisks && item.aiRisks.length > 0 && (
													<p className="text-[11px] text-gray-500">
														Lưu ý: {item.aiRisks.map((r) => r.note).join(" · ")}
													</p>
												)}
											</div>
										</details>
									)}
								</div>

								<Button
									variant="outline"
									size="sm"
									onClick={() => onQuickCreate(item.id)}
									disabled={busy}
									className="min-h-9 w-full justify-between rounded-xl bg-white"
								>
									<span>{busy ? "Đang kiểm tra..." : "Tạo nhanh chuyến từ gợi ý này"}</span>
									<ArrowRight className="size-3.5" aria-hidden="true" />
								</Button>
							</div>
						);
					})}
				</div>
			)}

			{history.length > 0 && (
				<details className="border-t border-[#e8efe8] pt-2.5">
					<summary className="cursor-pointer text-xs font-semibold text-gray-600 hover:text-[#164027]">
						Lịch sử gợi ý đã tạo ({history.length})
					</summary>
					<ul className="mt-2 divide-y divide-[#eef3ee] text-xs text-gray-600">
						{history.slice(0, 5).map((h) => (
							<li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
								<span>
									<strong className="font-medium text-gray-900">
										{h.routeName || "Tuyến trekking"}
									</strong>{" "}
									· {formatMonthVi(h.monthHint)} · {formatSuggestedPrice(h.suggestedPricePerPerson)}
								</span>
								<span className="text-gray-400">{formatShortDateVi(h.jobCreatedAt)}</span>
							</li>
						))}
					</ul>
				</details>
			)}
		</Card>
	);
}
