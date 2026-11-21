import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck2, CloudSun, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HttpError, queryKeys } from "../../../core/api";
import { Button, StatusBadge } from "../../../shared/components";
import { toast } from "../../../shared/components/Toast";
import {
	TRIP_TYPE_LABELS,
	formatMonthVi,
	formatShortDateVi,
	formatSuggestedPrice,
	resolveVietnamPresetRange,
} from "../../host-analytics/constants";
import { hostAnalyticsService } from "../../host-analytics/services/host-analytics.service";
import type {
	HostSuggestionJobResponse,
	HostTripSuggestionItem,
	QuickCreateContextResponse,
	SuggestionDateOption,
	SuggestionWeatherSummary,
} from "../../host-analytics/types";

export interface CreateTripSuggestionsPanelProps {
	owner: string;
	onApplySuggestion: (suggestionId: string, prefill: QuickCreateContextResponse["prefill"]) => void;
}

const HOLIDAY_MONTH_SHORT_BADGE: Record<number, string> = {
	1: "Tết Dương lịch",
	2: "Tết Nguyên đán",
	4: "Giỗ Tổ & 30/4",
	5: "Lễ 01/05",
	9: "Lễ 02/09",
};

function getMonthHolidayTag(monthKey: string): string | null {
	const monthNum = Number(monthKey.split("-")[1]);
	return HOLIDAY_MONTH_SHORT_BADGE[monthNum] ?? null;
}

function buildUpcomingMonths(count = 6): string[] {
	const earliest = new Date(Date.now() + 14 * 86_400_000 + 7 * 3600_000);
	let year = earliest.getUTCFullYear();
	let month = earliest.getUTCMonth() + 1;
	const result: string[] = [];
	for (let i = 0; i < count; i += 1) {
		result.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return result;
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
	if (weather.status === "beyond_horizon")
		return "Ngày đi còn xa (chưa có dự báo thời tiết chi tiết)";
	if (weather.status === "unavailable") return "Tạm thiếu dự báo thời tiết";
	if (weather.riskLevel === "red") return "Thời tiết xấu (nên tránh)";
	if (weather.riskLevel === "yellow") return "Thời tiết cần lưu ý";
	return "Thời tiết thuận lợi";
}

function cleanWeatherDetail(weather: SuggestionWeatherSummary): string | null {
	if (weather.status !== "available") return null;
	return weather.summary.replace(/^[^:]+:\s*/, "").trim();
}

function buildConflictAndWeatherMessage(
	startsAtIso: string | null,
	weather: SuggestionWeatherSummary | null
): string | null {
	if (!startsAtIso) return null;
	const shortDate = formatShortDateVi(startsAtIso);
	if (!shortDate) return null;
	if (weather?.status === "available" && weather.riskLevel === "green") {
		return `Ngày ${shortDate} bạn đang trống lịch và thời tiết thuận lợi`;
	}
	return `Ngày ${shortDate} bạn đang trống lịch dẫn đoàn`;
}

/**
 * Integrated "Gợi ý tổ chức chuyến đi" workspace on CreateTripPage (create mode only).
 * Supports conflict-aware scheduling, holiday & long-weekend boost, route review & safety signals,
 * multi-date comparison per route card, and 1-click form prefill.
 */
export function CreateTripSuggestionsPanel({
	owner,
	onApplySuggestion,
}: CreateTripSuggestionsPanelProps) {
	const queryClient = useQueryClient();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
	const [seenRouteIds, setSeenRouteIds] = useState<string[]>([]);
	const [selectedDateIdxByCard, setSelectedDateIdxByCard] = useState<Record<string, number>>({});
	const upcomingMonths = useMemo(() => buildUpcomingMonths(6), []);

	const latestQuery = useQuery<HostSuggestionJobResponse | null>({
		queryKey: queryKeys.hostAnalytics.latestSuggestion(owner),
		queryFn: async () => {
			try {
				return await hostAnalyticsService.getLatestSuggestionJob();
			} catch (error) {
				if (error instanceof HttpError && error.status === 404) return null;
				throw error;
			}
		},
		enabled: Boolean(owner),
		retry: false,
		refetchInterval: (query) => {
			if (trackedJobId) return false;
			const status = query.state.data?.status;
			return status === "queued" || status === "running" ? 1500 : false;
		},
	});

	const trackedQuery = useQuery<HostSuggestionJobResponse>({
		queryKey: queryKeys.hostAnalytics.suggestionJob(owner, trackedJobId ?? ""),
		queryFn: () => hostAnalyticsService.getSuggestionJobById(trackedJobId as string),
		enabled: Boolean(owner && trackedJobId),
		retry: false,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status === "queued" || status === "running" ? 1500 : false;
		},
	});

	useEffect(() => {
		if (!trackedQuery.data) return;
		if (trackedQuery.data.status === "succeeded" || trackedQuery.data.status === "failed") {
			queryClient.setQueryData(queryKeys.hostAnalytics.latestSuggestion(owner), trackedQuery.data);
			setTrackedJobId(null);
		}
	}, [trackedQuery.data, owner, queryClient]);

	const activeJob = trackedQuery.data ?? latestQuery.data ?? null;
	const topSuggestions = (activeJob?.suggestions ?? []).slice(0, 3);
	const isPolling =
		activeJob?.status === "queued" || activeJob?.status === "running" || Boolean(trackedJobId);

	const generateMutation = useMutation({
		mutationFn: async (opts: { monthHint?: string; excludeRouteIds?: string[] }) => {
			const range = resolveVietnamPresetRange("12m");
			return hostAnalyticsService.createSuggestionJob({
				from: range.from,
				to: range.to,
				monthHint: opts.monthHint || undefined,
				excludeRouteIds:
					opts.excludeRouteIds && opts.excludeRouteIds.length > 0
						? opts.excludeRouteIds
						: undefined,
				refresh: true,
			});
		},
		onSuccess: (job) => {
			setSelectedDateIdxByCard({});
			queryClient.setQueryData(queryKeys.hostAnalytics.latestSuggestion(owner), job);
			if (job.status === "queued" || job.status === "running") {
				setTrackedJobId(job.id);
			}
		},
		onError: () => {
			toast.error("Không thể tổng hợp gợi ý mới lúc này. Vui lòng thử lại.");
		},
	});

	const handleSelectMonth = (month: string) => {
		setSelectedMonth(month);
		setSeenRouteIds([]);
		generateMutation.mutate({
			monthHint: month || undefined,
			excludeRouteIds: undefined,
		});
	};

	const handleGenerateAlternative = () => {
		const currentIds = topSuggestions.map((s) => s.routeId);
		const combined = Array.from(new Set([...seenRouteIds, ...currentIds]));
		const nextExcluded = combined.length >= 6 ? currentIds : combined;
		setSeenRouteIds(nextExcluded);
		generateMutation.mutate({
			monthHint: selectedMonth || undefined,
			excludeRouteIds: nextExcluded,
		});
	};

	const handleUse = async (item: HostTripSuggestionItem, chosenOption?: SuggestionDateOption) => {
		if (busyId) return;
		setBusyId(item.id);
		try {
			const ctx = await hostAnalyticsService.getQuickCreateContext(item.id);
			const prefill: QuickCreateContextResponse["prefill"] = chosenOption
				? {
						...ctx.prefill,
						startsAt: chosenOption.startsAt,
						endsAt: chosenOption.endsAt,
						meetingAt: chosenOption.meetingAt,
						bookingDeadline: chosenOption.bookingDeadline,
					}
				: ctx.prefill;
			onApplySuggestion(item.id, prefill);
			toast.success("Đã điền thông tin từ gợi ý chuyến đi. Vui lòng kiểm tra trước khi lưu.");
		} catch {
			toast.error("Không thể áp dụng gợi ý này. Vui lòng kiểm tra trạng thái tuyến.");
		} finally {
			setBusyId(null);
		}
	};

	const isGenerating = generateMutation.isPending || isPolling;

	return (
		<details
			open
			className="mb-5 rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-xs sm:p-6"
		>
			<summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<Sparkles className="size-4 text-[#164027]" aria-hidden="true" />
					<span className="text-lg font-bold tracking-tight text-[#10221b]">
						Gợi ý tổ chức chuyến đi
					</span>
					<StatusBadge tone="info">Tham khảo</StatusBadge>
				</div>
				<span className="text-xs font-medium text-[#667a6d]">Bấm để thu gọn / mở rộng</span>
			</summary>

			<div className="mt-4 space-y-4 border-t border-[#edf2ed] pt-4">
				{/* Hàng điều khiển: Chọn tháng gợi ý + Nút Đổi gợi ý khác */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<fieldset
						className="flex flex-wrap items-center gap-1.5 border-0 p-0"
						aria-label="Chọn tháng gợi ý"
					>
						<span className="mr-1 text-xs font-semibold text-[#53674d]">Tháng muốn mở:</span>
						<button
							type="button"
							disabled={isGenerating}
							onClick={() => handleSelectMonth("")}
							className={`min-h-8 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors duration-150 ${
								selectedMonth === ""
									? "bg-[#164027] text-white shadow-2xs"
									: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8] hover:text-[#164027]"
							}`}
						>
							Gần nhất (Có dự báo thời tiết)
						</button>
						{upcomingMonths.map((m) => {
							const holidayTag = getMonthHolidayTag(m);
							const isSelected = selectedMonth === m;
							return (
								<button
									key={m}
									type="button"
									disabled={isGenerating}
									onClick={() => handleSelectMonth(m)}
									className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors duration-150 ${
										isSelected
											? "bg-[#164027] text-white shadow-2xs"
											: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8] hover:text-[#164027]"
									}`}
								>
									<span>{formatMonthVi(m)}</span>
									{holidayTag && (
										<span
											className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
												isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
											}`}
										>
											{holidayTag}
										</span>
									)}
								</button>
							);
						})}
					</fieldset>

					<Button
						variant="primary"
						size="sm"
						disabled={isGenerating}
						onClick={handleGenerateAlternative}
						className="min-h-9 rounded-xl"
					>
						<RefreshCw
							className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`}
							aria-hidden="true"
						/>
						<span>
							{isGenerating
								? "Đang tìm gợi ý mới..."
								: topSuggestions.length > 0
									? "Đổi gợi ý khác"
									: "Gợi ý chuyến đi"}
						</span>
					</Button>
				</div>

				{/* Danh sách 3 thẻ gợi ý dàn ngang 3 cột (Impeccable Bento Grid) */}
				{latestQuery.isPending ? (
					<p className="py-6 text-center text-xs text-[#647468]">Đang tải gợi ý gần nhất...</p>
				) : isGenerating ? (
					<div
						aria-live="polite"
						className="rounded-xl bg-[#f4f8f4] px-4 py-6 text-center text-xs font-medium text-[#2c4234]"
					>
						Đang tổng hợp gợi ý tuyến, đối chiếu lịch trống của bạn và dự báo thời tiết cho{" "}
						{selectedMonth ? formatMonthVi(selectedMonth) : "tháng gần nhất"}...
					</div>
				) : topSuggestions.length === 0 ? (
					<div className="rounded-xl bg-[#f8faf8] px-4 py-6 text-center text-xs text-[#526357]">
						Chưa có gợi ý nào. Bấm <strong>“Gợi ý chuyến đi”</strong> hoặc chọn một tháng ở trên để
						nhận đề xuất kèm dự báo thời tiết.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
						{topSuggestions.map((item) => {
							const busy = busyId === item.id;
							const dateOptions = item.dateOptions ?? [];
							const selectedIdx = Math.min(
								selectedDateIdxByCard[item.id] ?? 0,
								Math.max(0, dateOptions.length - 1)
							);
							const activeOption: SuggestionDateOption | undefined = dateOptions[selectedIdx];
							const activeStartsAt = activeOption?.startsAt ?? item.suggestedStartsAt;
							const activeWeather = activeOption?.weatherSummary ?? item.weatherSummary;

							const weatherDetail = activeWeather ? cleanWeatherDetail(activeWeather) : null;
							const hasAiNarrative = Boolean(
								item.aiSeasonNote || (item.aiRisks && item.aiRisks.length > 0)
							);
							const conflictAndWeatherText = buildConflictAndWeatherMessage(
								activeStartsAt,
								activeWeather
							);

							return (
								<article
									key={item.id}
									className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-[#fbfcfb] p-5 transition-colors duration-150 hover:border-[#bdd0bf]"
								>
									<div className="flex flex-1 flex-col gap-3">
										{/* Tầng 1: Tháng + Loại chuyến + Dịp lễ (nếu có) + Ngày đang chọn */}
										<div className="flex min-h-6 flex-wrap items-center justify-between gap-1.5">
											<div className="flex flex-wrap items-center gap-1.5">
												<StatusBadge tone="success">{formatMonthVi(item.monthHint)}</StatusBadge>
												<StatusBadge tone="neutral">{TRIP_TYPE_LABELS[item.tripType]}</StatusBadge>
												{item.holidayHighlight && (
													<StatusBadge tone="warning">{item.holidayHighlight.label}</StatusBadge>
												)}
											</div>
											{activeStartsAt && (
												<span className="text-xs font-bold text-[#164027]">
													{formatShortDateVi(activeStartsAt)}
												</span>
											)}
										</div>

										{/* Tầng 2: Tên tuyến & Thông số lịch sử (cố định chiều cao đều nhau giữa 3 thẻ) */}
										<div className="min-h-[84px]">
											<h3
												className="line-clamp-1 text-base font-bold tracking-tight text-[#10221b]"
												title={item.routeName || "Tuyến trekking của bạn"}
											>
												{item.routeName || "Tuyến trekking của bạn"}
											</h3>
											<div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#53674d]">
												<span>{item.areaName || "Chưa gắn khu vực"}</span>
												<span>·</span>
												<span className="font-bold text-[#10221b]">
													{formatSuggestedPrice(item.suggestedPricePerPerson)}
												</span>
												{item.suggestedCapacityMin !== null && (
													<>
														<span>·</span>
														<span>Từ {item.suggestedCapacityMin} khách</span>
													</>
												)}
											</div>
											{item.rationaleLabels[0] && (
												<p
													className="mt-1 line-clamp-1 text-xs text-[#667a6d]"
													title={item.rationaleLabels[0]}
												>
													{item.rationaleLabels[0]}
												</p>
											)}
											<p
												className={`mt-1.5 line-clamp-1 text-xs font-medium ${
													!item.routeReviewSummary
														? "text-[#8a998e]"
														: item.routeReviewSummary.hasSlipOrWeatherCaution
															? "text-amber-800"
															: "text-[#164027]"
												}`}
												title={
													item.routeReviewSummary?.highlightText ?? "Chưa có đánh giá cho tuyến này"
												}
											>
												{item.routeReviewSummary?.highlightText ?? "Chưa có đánh giá cho tuyến này"}
											</p>
										</div>

										{/* Tầng 3: So sánh & chọn nhanh giữa 2–3 khung ngày trống lịch trong tháng */}
										<div className="min-h-[54px] space-y-1.5 border-t border-[#e8efe8] pt-2.5">
											<span className="block text-[11px] font-semibold tracking-wide text-[#53674d]">
												Chọn ngày khởi hành phù hợp:
											</span>
											<div className="flex flex-wrap gap-1.5">
												{dateOptions.map((opt, idx) => {
													const isSelected = idx === selectedIdx;
													const isGreen =
														opt.weatherSummary?.status === "available" &&
														opt.weatherSummary.riskLevel === "green";
													return (
														<button
															key={opt.startsAt}
															type="button"
															onClick={() =>
																setSelectedDateIdxByCard((prev) => ({
																	...prev,
																	[item.id]: idx,
																}))
															}
															className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
																isSelected
																	? "bg-[#164027] text-white shadow-2xs"
																	: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8]"
															}`}
														>
															<span>{opt.label}</span>
															{isGreen && (
																<span
																	className={`size-1.5 rounded-full ${
																		isSelected ? "bg-emerald-300" : "bg-emerald-600"
																	}`}
																	title="Thời tiết thuận lợi"
																/>
															)}
														</button>
													);
												})}
											</div>
										</div>

										{/* Tầng 4: Trạng thái lịch trống của Host & Dự báo thời tiết */}
										<div className="space-y-1.5 border-t border-[#e8efe8] pt-2.5 text-xs">
											{conflictAndWeatherText && (
												<p className="flex items-center gap-1.5 font-semibold text-[#164027]">
													<CalendarCheck2 className="size-3.5 shrink-0" aria-hidden="true" />
													<span className="line-clamp-1">{conflictAndWeatherText}</span>
												</p>
											)}

											{activeWeather && (
												<div className="space-y-1">
													<div className="flex flex-wrap items-center gap-1.5">
														<CloudSun
															className="size-3.5 shrink-0 text-[#164027]"
															aria-hidden="true"
														/>
														<StatusBadge tone={weatherBadgeTone(activeWeather)}>
															{weatherBadgeLabel(activeWeather)}
														</StatusBadge>
													</div>
													{weatherDetail && (
														<p className="line-clamp-1 text-[#374151]" title={weatherDetail}>
															{weatherDetail}
														</p>
													)}
												</div>
											)}

											{item.holidayHighlight?.capacityBoostNote && (
												<p className="line-clamp-2 text-[11px] leading-relaxed text-amber-900">
													{item.holidayHighlight.capacityBoostNote}
												</p>
											)}
										</div>

										{/* Tầng 5: Đặc điểm thời tiết & lưu ý tháng từ AI (nằm ngay dưới trạng thái thời tiết) */}
										{hasAiNarrative && (
											<details className="group pt-0.5 text-xs">
												<summary className="cursor-pointer font-medium text-[#164027] hover:underline">
													<span>Đặc điểm thời tiết & lưu ý tháng này (AI gợi ý)</span>
												</summary>
												<div className="mt-1.5 space-y-1 border-l-2 border-[#164027]/35 pl-2.5 text-[#374151]">
													{item.aiSeasonNote && (
														<p className="leading-relaxed">{item.aiSeasonNote}</p>
													)}
													{item.aiRisks && item.aiRisks.length > 0 && (
														<p className="text-[11px] text-[#667a6d]">
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
										disabled={busy}
										onClick={() => void handleUse(item, activeOption)}
										className="min-h-9 w-full justify-between rounded-xl bg-white hover:bg-[#edf4e8]"
									>
										<span>
											{busy
												? "Đang điền..."
												: activeOption
													? `Dùng gợi ý (${activeOption.label})`
													: "Dùng gợi ý này"}
										</span>
										<ArrowRight className="size-3.5" aria-hidden="true" />
									</Button>
								</article>
							);
						})}
					</div>
				)}
			</div>
		</details>
	);
}
