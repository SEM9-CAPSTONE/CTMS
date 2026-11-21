import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRight,
	ChevronUp,
	CloudSun,
	RefreshCw,
	Sparkles,
	Star,
	TrendingUp,
} from "lucide-react";
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

function buildUpcomingMonths(count = 5): string[] {
	const earliest = new Date(Date.now() + 14 * 86_400_000 + 7 * 3600_000);
	let year = earliest.getUTCFullYear();
	let month = earliest.getUTCMonth() + 2; // Skip the nearest month already covered by "Gần nhất"
	if (month > 12) {
		month -= 12;
		year += 1;
	}
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

function stripParens(text: string): string {
	return text.replace(/\s*\([^)]*\)/g, "").trim();
}

function weatherBadgeTone(
	weather: SuggestionWeatherSummary
): "success" | "warning" | "danger" | "neutral" {
	if (weather.status !== "available") return "neutral";
	if (weather.riskLevel === "red") return "danger";
	if (weather.riskLevel === "yellow") return "warning";
	return "success";
}

function weatherBadgeLabel(weather: SuggestionWeatherSummary | null): string {
	if (!weather || weather.status !== "available") return "Chưa có dự báo thời tiết";
	if (weather.riskLevel === "red") return "Thời tiết xấu";
	if (weather.riskLevel === "yellow") return "Thời tiết cần lưu ý";
	return "Thời tiết thuận lợi";
}

interface HighlightMetricChip {
	label: string;
	badge?: string;
	value: string;
	tone: "emerald" | "amber" | "neutral";
}

function buildMetricHighlights(item: HostTripSuggestionItem): HighlightMetricChip[] {
	const chips: HighlightMetricChip[] = [];

	const rationale = item.rationaleLabels[0];
	if (rationale) {
		const lower = rationale.toLowerCase();
		if (lower.includes("doanh thu")) {
			chips.push({ label: "Doanh thu", value: "Top doanh thu", tone: "emerald" });
		} else if (lower.includes("lấp đầy")) {
			chips.push({ label: "Đặt chỗ", value: "Tỷ lệ đặt chỗ cao", tone: "emerald" });
		} else if (lower.includes("nhu cầu") || lower.includes("đặt")) {
			chips.push({ label: "Nhu cầu", value: "Nhu cầu đặt cao", tone: "emerald" });
		} else {
			chips.push({ label: "Hiệu quả", value: stripParens(rationale), tone: "neutral" });
		}
	}

	if (
		item.routeReviewSummary &&
		item.routeReviewSummary.reviewCount > 0 &&
		item.routeReviewSummary.averageRating !== null
	) {
		const avg = item.routeReviewSummary.averageRating;
		const isLow = item.routeReviewSummary.hasSlipOrWeatherCaution || avg < 3.5;
		chips.push({
			label: "Đánh giá",
			badge: `${Number(avg.toFixed(1))}★`,
			value: isLow ? "Cần cải thiện" : "Đánh giá tốt",
			tone: isLow ? "amber" : "emerald",
		});
	}

	return chips;
}

export function CreateTripSuggestionsPanel({
	owner,
	onApplySuggestion,
}: CreateTripSuggestionsPanelProps) {
	const queryClient = useQueryClient();
	const [isExpanded, setIsExpanded] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
	const [seenRouteIds, setSeenRouteIds] = useState<string[]>([]);
	const [selectedDateIdxByCard, setSelectedDateIdxByCard] = useState<Record<string, number>>({});
	const upcomingMonths = useMemo(() => buildUpcomingMonths(5), []);

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
		<section className="mb-5 overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs">
			{/* Thanh tiêu đề xanh rêu nổi bật có nút Xem gợi ý / Thu gọn */}
			<div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden bg-gradient-to-r from-[#164027] via-[#1b4d30] to-[#2c6644] px-5 py-4">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/8"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-24 -bottom-12 size-32 rounded-full bg-white/6"
				/>

				<div className="relative z-10 flex items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
						<Sparkles className="size-4" aria-hidden="true" />
					</span>
					<h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
						Gợi ý tổ chức chuyến đi
					</h2>
				</div>

				<button
					type="button"
					onClick={() => setIsExpanded((prev) => !prev)}
					aria-expanded={isExpanded}
					className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#164027] shadow-xs transition hover:bg-[#edf5ef]"
				>
					{isExpanded ? (
						<>
							<ChevronUp className="size-3.5" aria-hidden="true" />
							<span>Thu gọn</span>
						</>
					) : (
						<>
							<Sparkles className="size-3.5" aria-hidden="true" />
							<span>Xem gợi ý</span>
						</>
					)}
				</button>
			</div>

			{isExpanded && (
				<div className="space-y-4 p-4 sm:p-6">
					{/* Hàng điều khiển: Chọn tháng + Nút Đổi gợi ý khác */}
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
								Gần nhất
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

					{/* Danh sách 3 thẻ gợi ý */}
					{latestQuery.isPending ? (
						<p className="py-6 text-center text-xs text-[#647468]">Đang tải gợi ý gần nhất...</p>
					) : isGenerating ? (
						<div
							aria-live="polite"
							className="rounded-xl bg-[#f4f8f4] px-4 py-6 text-center text-xs font-medium text-[#2c4234]"
						>
							Đang tổng hợp gợi ý tuyến cho{" "}
							{selectedMonth ? formatMonthVi(selectedMonth) : "tháng gần nhất"}...
						</div>
					) : topSuggestions.length === 0 ? (
						<div className="rounded-xl bg-[#f8faf8] px-4 py-6 text-center text-xs text-[#526357]">
							Chưa có gợi ý nào. Bấm <strong>“Gợi ý chuyến đi”</strong> hoặc chọn tháng ở trên.
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

								const weatherLabel = weatherBadgeLabel(activeWeather);
								const weatherTone = activeWeather ? weatherBadgeTone(activeWeather) : "neutral";
								const metricHighlights = buildMetricHighlights(item);
								const hasAiNarrative = Boolean(
									item.aiSeasonNote || (item.aiRisks && item.aiRisks.length > 0)
								);
								const shortDate = activeStartsAt ? formatShortDateVi(activeStartsAt) : null;

								return (
									<article
										key={item.id}
										className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-[#fbfcfb] p-5 transition-colors duration-150 hover:border-[#bdd0bf]"
									>
										<div className="flex flex-1 flex-col gap-3">
											{/* Tầng 1: Tháng + Loại chuyến + Dịp lễ + Ngày chọn */}
											<div className="flex min-h-6 flex-wrap items-center justify-between gap-1.5">
												<div className="flex flex-wrap items-center gap-1.5">
													<StatusBadge tone="success">{formatMonthVi(item.monthHint)}</StatusBadge>
													<StatusBadge tone="neutral">
														{TRIP_TYPE_LABELS[item.tripType]}
													</StatusBadge>
													{item.holidayHighlight && (
														<StatusBadge tone="warning">{item.holidayHighlight.label}</StatusBadge>
													)}
												</div>
												{shortDate && (
													<span className="text-xs font-bold text-[#164027]">{shortDate}</span>
												)}
											</div>

											{/* Tầng 2: Tên tuyến + Giá dự kiến mỗi người */}
											<div>
												<h3
													className="line-clamp-1 text-base font-bold tracking-tight text-[#10221b]"
													title={item.routeName || "Tuyến trekking của bạn"}
												>
													{item.routeName || "Tuyến trekking của bạn"}
												</h3>
												<p className="mt-1 text-xs font-bold text-[#10221b]">
													{formatSuggestedPrice(item.suggestedPricePerPerson)}
												</p>
											</div>

											{/* Tầng 2.5: Mini-cards thể hiện rõ Top doanh thu / Tỷ lệ lấp đầy / Đánh giá */}
											{metricHighlights.length > 0 && (
												<div className="flex flex-wrap items-stretch gap-2">
													{metricHighlights.map((chip) => (
														<div
															key={chip.label}
															className={`rounded-xl px-3 py-1.5 ${
																chip.tone === "amber"
																	? "border border-amber-200/80 bg-amber-50/90 text-amber-950"
																	: chip.tone === "emerald"
																		? "bg-[#edf5ef] text-[#164027]"
																		: "bg-[#f3f6f3] text-[#374151]"
															}`}
														>
															<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
																<span className="flex items-center gap-1 opacity-80">
																	{chip.label === "Đánh giá" ? (
																		<Star className="size-3 shrink-0" aria-hidden="true" />
																	) : (
																		<TrendingUp className="size-3 shrink-0" aria-hidden="true" />
																	)}
																	<span>{chip.label}</span>
																</span>
																{chip.badge && (
																	<span className="text-[11px] font-bold normal-case">
																		{chip.badge}
																	</span>
																)}
															</div>
															<p className="mt-0.5 truncate text-xs font-bold" title={chip.value}>
																{chip.value}
															</p>
														</div>
													))}
												</div>
											)}

											{/* Tầng 3: Chọn ngày khởi hành */}
											{dateOptions.length > 0 && (
												<div className="space-y-1.5 border-t border-[#e8efe8] pt-2.5">
													<span className="block text-[11px] font-semibold text-[#53674d]">
														Chọn ngày khởi hành:
													</span>
													<div className="flex flex-wrap gap-1.5">
														{dateOptions.map((opt, idx) => {
															const isSelected = idx === selectedIdx;
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
																	className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
																		isSelected
																			? "bg-[#164027] text-white shadow-2xs"
																			: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8]"
																	}`}
																>
																	<span>{opt.label}</span>
																</button>
															);
														})}
													</div>
												</div>
											)}

											{/* Tầng 4: Trạng thái dự báo thời tiết (đồng đều giữa 3 thẻ) */}
											<div className="flex items-center gap-2 border-t border-[#e8efe8] pt-2.5 text-xs">
												<CloudSun className="size-3.5 shrink-0 text-[#164027]" aria-hidden="true" />
												<StatusBadge tone={weatherTone}>{weatherLabel}</StatusBadge>
											</div>

											{/* Tầng 5: Lưu ý thời tiết tháng */}
											{hasAiNarrative && (
												<details className="group pt-0.5 text-xs">
													<summary className="cursor-pointer font-medium text-[#164027] hover:underline">
														<span>Lưu ý thời tiết tháng này</span>
													</summary>
													<div className="mt-1.5 space-y-1 border-l-2 border-[#164027]/35 pl-2.5 text-[#374151]">
														{item.aiSeasonNote && (
															<p className="leading-relaxed">{stripParens(item.aiSeasonNote)}</p>
														)}
														{item.aiRisks && item.aiRisks.length > 0 && (
															<p className="text-[11px] text-[#667a6d]">
																Lưu ý: {item.aiRisks.map((r) => stripParens(r.note)).join(" · ")}
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
														? `Dùng gợi ý · ${activeOption.label}`
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
			)}
		</section>
	);
}
