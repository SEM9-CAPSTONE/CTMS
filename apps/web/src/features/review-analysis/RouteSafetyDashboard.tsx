import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	AlertTriangle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	HelpCircle,
	Info,
	Loader2,
	Quote,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import {
	buttonClass,
	incidentOccurrenceLabels,
	incidentSeverityLabels,
	incidentTypeLabels,
	panelClass,
	routeSafetyDisclaimer,
} from "./constants";
import { analysisService } from "./service";
import type { IncidentSeverity, IncidentSignalSummary, RouteSafetyItem } from "./types";

interface RouteSafetyDashboardProps {
	actor: string;
	selectedRouteId?: string;
	embedded?: boolean;
}

export function RouteSafetyDashboard({
	actor,
	selectedRouteId,
	embedded = false,
}: RouteSafetyDashboardProps) {
	const [page, setPage] = useState(1);
	const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
	const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

	const query = useQuery({
		queryKey: queryKeys.reviewAnalytics.routesSafetyOverview(actor, page, selectedRouteId),
		queryFn: ({ signal }) =>
			analysisService.routeSafetyOverview(
				{
					routeId: selectedRouteId || undefined,
					page,
					limit: 5,
				},
				signal
			),
		retry: false,
	});

	const toggleQuotes = (id: string) => {
		setExpandedQuotes((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const toggleRoute = (id: string) => {
		setExpandedRoutes((prev) => ({
			...prev,
			[id]: !(prev[id] ?? false),
		}));
	};

	const items = query.data?.items ?? [];
	const total = query.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / 5));
	const threshold = query.data?.sampleThreshold ?? 10;

	return (
		<div className="space-y-4">
			{/* Mandatory Safety Copywriting Disclaimer Banner */}
			<div
				role="note"
				className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 sm:text-sm"
			>
				<Info className="mt-0.5 size-5 shrink-0 text-amber-700" />
				<div>
					<p className="font-semibold text-amber-900">Lưu ý quan trọng</p>
					<p className="mt-0.5 leading-5">{routeSafetyDisclaimer}</p>
				</div>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-lg font-bold text-[#10221b]">
							{embedded ? "Tín hiệu an toàn từ đánh giá" : "Tổng hợp tín hiệu từ đánh giá"}
						</h2>
						<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
							📍 Dữ liệu gộp trên toàn bộ cung đường
						</span>
					</div>
					<p className="mt-1 text-xs text-[#4b5563]">
						Phân tích các phản ánh của người tham gia về sự cố và lưu ý phòng ngừa theo từng cung
						đường.
					</p>
				</div>
				{embedded && (
					<button
						type="button"
						onClick={() => {
							const target =
								document.getElementById("aspect-card-safety") ||
								document.getElementById("section-aspects");
							if (target) {
								target.scrollIntoView({ behavior: "smooth", block: "center" });
								target.classList.add("ring-2", "ring-[#164027]", "bg-[#edf4e8]");
								setTimeout(() => {
									target.classList.remove("ring-2", "ring-[#164027]", "bg-[#edf4e8]");
								}, 2200);
							}
						}}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#164027] bg-[#edf4e8] px-3.5 py-1.5 text-xs font-semibold text-[#164027] shadow-2xs hover:bg-[#dfe8df] transition"
					>
						<ShieldAlert className="size-3.5 text-[#164027]" />
						<span>Xem phản hồi an toàn của chuyến này</span>
					</button>
				)}
			</div>

			{query.isPending ? (
				<div
					className={`${panelClass} flex items-center justify-center ${embedded ? "py-10" : "py-20"} text-[#53674d]`}
				>
					<Loader2 className="mr-3 size-6 animate-spin text-[#164027]" />
					<span className="text-sm font-medium">Đang tải tín hiệu từ đánh giá…</span>
				</div>
			) : query.isError ? (
				<div role="alert" className={`${panelClass} text-center py-12`}>
					<AlertCircle className="mx-auto mb-3 size-10 text-rose-600" />
					<h3 className="text-base font-semibold text-[#10221b]">
						Không thể tải tín hiệu từ đánh giá
					</h3>
					<p className="mt-1 text-sm text-[#728070]">
						Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.
					</p>
					<button type="button" onClick={() => query.refetch()} className={`${buttonClass} mt-4`}>
						Thử lại
					</button>
				</div>
			) : items.length === 0 ? (
				<div className={`${panelClass} ${embedded ? "py-10" : "py-16"} text-center`}>
					<ShieldAlert className="mx-auto mb-3 size-8 text-[#8a9d7a]" />
					<h3 className="font-semibold text-[#10221b]">Chưa có tín hiệu ghi nhận từ đánh giá</h3>
					<p className="mx-auto mt-1 max-w-md text-sm text-[#728070]">
						{embedded
							? "Chưa ghi nhận tín hiệu an toàn nào từ đánh giá liên quan đến cung đường của chuyến đi này."
							: "Khi các đánh giá hoàn tất phân tích an toàn, các tín hiệu phản ánh sẽ được hiển thị theo từng cung đường."}
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{items.map((route: RouteSafetyItem, index: number) => {
						const isRouteOpen = embedded ? (expandedRoutes[route.routeId] ?? index === 0) : true;

						return (
							<article
								key={route.routeId}
								className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs"
							>
								{/* Route Header */}
								<header className="border-b border-[#dfe8df] bg-[#f9faf8] p-4 sm:p-5">
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<h3 className="text-base font-bold text-[#10221b]">{route.routeName}</h3>
											<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#53674d]">
												<span>
													Tổng đánh giá hợp lệ:{" "}
													<strong className="text-[#10221b]">{route.totalReviews}</strong>
												</span>
												<span>•</span>
												<span>
													Đã phân tích:{" "}
													<strong className="text-[#10221b]">{route.analyzedReviewsCount}</strong>
												</span>
												<span>•</span>
												<span>
													Độ bao phủ:{" "}
													<strong className="text-[#10221b]">
														{Math.round(route.coverageRate * 100)}%
													</strong>
												</span>
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-2">
											{!route.hasSufficientSample && (
												<span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 sm:self-auto">
													<Info className="size-3.5" />
													Chưa đạt ngưỡng mẫu ({threshold})
												</span>
											)}
											{embedded && (
												<button
													type="button"
													onClick={() => toggleRoute(route.routeId)}
													className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] bg-white px-2.5 py-1 text-xs font-semibold text-[#164027] hover:bg-[#edf4e8]"
													aria-expanded={isRouteOpen}
													aria-label={`Chi tiết tín hiệu an toàn cung đường ${route.routeName}`}
												>
													<span>{isRouteOpen ? "Thu gọn" : "Chi tiết"}</span>
													{isRouteOpen ? (
														<ChevronUp className="size-3.5" />
													) : (
														<ChevronDown className="size-3.5" />
													)}
												</button>
											)}
										</div>
									</div>

									{/* Distinct Reviews Metrics */}
									<div className="mt-3 flex flex-wrap gap-2.5 pt-2 border-t border-[#e6eee6] text-xs">
										<span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 font-medium text-rose-900">
											<span className="font-bold">{route.totalDistinctReviewsWithIncidents}</span>{" "}
											đánh giá mô tả sự cố
										</span>
										<span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 font-medium text-amber-900">
											<span className="font-bold">{route.totalDistinctReviewsWithWarnings}</span>{" "}
											đánh giá có cảnh báo phòng ngừa
										</span>
										<span className="text-[11px] text-[#728070] self-center">
											(Mỗi đánh giá có thể đề cập nhiều vấn đề, không cộng dồn các mục)
										</span>
									</div>

									{!route.hasSufficientSample && (
										<p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
											Cần tối thiểu {threshold} đánh giá hợp lệ để dữ liệu có độ đại diện cao hơn.
											Hiện tại số liệu chỉ phản ánh ghi nhận ban đầu.
										</p>
									)}
								</header>

								{/* Signals List */}
								{isRouteOpen && (
									<div className="divide-y divide-[#dfe8df] p-4 sm:p-5">
										<p className="pb-3 text-[11px] italic text-[#556955]">
											* Thanh phân bố thể hiện tỷ lệ giữa các phản ánh sự cố thực tế và cảnh báo
											phòng ngừa, không đo lường mức độ nghiêm trọng.
										</p>
										{route.incidentSignals.map((signal: IncidentSignalSummary) => {
											const key = `${route.routeId}-${signal.category}`;
											const isQuotesOpen = !!expandedQuotes[key];
											const totalMentions =
												signal.occurredCount + signal.warningCount + signal.unknownCount;

											return (
												<div key={signal.category} className="py-3.5 first:pt-0 last:pb-0">
													<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
														<div className="w-full space-y-1">
															<div className="flex items-center gap-2">
																<span className="text-sm font-bold text-[#10221b]">
																	{incidentTypeLabels[signal.category] || signal.category}
																</span>
																<span className="text-xs text-[#728070]">
																	({totalMentions} lượt nhắc)
																</span>
															</div>

															{/* Stacked Visual Distribution Bar - full width */}
															{totalMentions > 0 && (
																<div className="my-2 flex h-2 w-full overflow-hidden rounded-full bg-[#f0f3ed]">
																	{signal.occurredCount > 0 && (
																		<div
																			className="bg-[#c2410c] transition-all"
																			style={{
																				width: `${(signal.occurredCount / totalMentions) * 100}%`,
																			}}
																		/>
																	)}
																	{signal.warningCount > 0 && (
																		<div
																			className="bg-[#0284c7] transition-all"
																			style={{
																				width: `${(signal.warningCount / totalMentions) * 100}%`,
																			}}
																		/>
																	)}
																	{signal.unknownCount > 0 && (
																		<div
																			className="bg-[#64748b] transition-all"
																			style={{
																				width: `${(signal.unknownCount / totalMentions) * 100}%`,
																			}}
																		/>
																	)}
																</div>
															)}

															{/* 3 Strict Occurred States */}
															<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1">
																<span className="flex items-center gap-1.5 text-[#7c2d12] font-medium">
																	<AlertTriangle className="size-3.5 text-[#c2410c]" />
																	{incidentOccurrenceLabels.yes}:{" "}
																	<strong className="font-bold text-[#431407]">
																		{signal.occurredCount}
																	</strong>
																</span>

																<span className="flex items-center gap-1.5 text-sky-800 font-medium">
																	<Info className="size-3.5 text-[#0284c7]" />
																	{incidentOccurrenceLabels.warning}:{" "}
																	<strong className="font-bold text-sky-950">
																		{signal.warningCount}
																	</strong>
																</span>

																<span className="flex items-center gap-1.5 text-[#334155] font-medium">
																	<HelpCircle className="size-3.5 text-[#64748b]" />
																	{incidentOccurrenceLabels.unknown}:{" "}
																	<strong className="font-bold text-[#0f172a]">
																		{signal.unknownCount}
																	</strong>
																</span>
															</div>

															{/* Severity Breakdown */}
															{signal.occurredCount > 0 && (
																<div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[11px] text-[#53674d]">
																	<span className="font-medium text-[#728070]">Mức độ xảy ra:</span>
																	{(["minor", "moderate", "severe", "unknown"] as const).map(
																		(sev: IncidentSeverity) => {
																			const count = signal.severityBreakdown[sev] ?? 0;
																			if (count === 0) return null;
																			return (
																				<span
																					key={sev}
																					className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800"
																				>
																					{incidentSeverityLabels[sev]}: {count}
																				</span>
																			);
																		}
																	)}
																</div>
															)}
														</div>

														{/* Toggle Quotes button if quotes exist */}
														{signal.sampleQuotes.length > 0 && (
															<button
																type="button"
																onClick={() => toggleQuotes(key)}
																className="inline-flex items-center gap-1 self-start rounded-lg border border-[#dfe8df] bg-white px-2.5 py-1 text-xs font-semibold text-[#164027] hover:bg-[#edf4e8]"
															>
																<Quote className="size-3" />
																<span>{signal.sampleQuotes.length} trích dẫn mẫu</span>
																{isQuotesOpen ? (
																	<ChevronUp className="size-3.5" />
																) : (
																	<ChevronDown className="size-3.5" />
																)}
															</button>
														)}
													</div>

													{/* Collapsible Sample Quotes */}
													{isQuotesOpen && signal.sampleQuotes.length > 0 && (
														<div className="mt-3 space-y-2 rounded-xl border border-[#dfe8df] bg-[#fcfdfb] p-3 text-xs">
															<p className="font-semibold text-[#53674d]">
																Trích dẫn mẫu từ nội dung đánh giá:
															</p>
															<ul className="space-y-1.5">
																{signal.sampleQuotes.map((q, idx) => (
																	<li
																		key={`${signal.category}-${idx}-${q.slice(0, 15)}`}
																		className="flex items-start gap-2 rounded-md bg-white p-2 italic text-[#10221b] shadow-2xs"
																	>
																		<span className="text-[#8a9d7a]">&ldquo;</span>
																		<span className="flex-1">{q}</span>
																		<span className="text-[#8a9d7a]">&rdquo;</span>
																	</li>
																))}
															</ul>
															<p className="text-[11px] text-[#728070]">
																(Tối đa 3 trích dẫn mẫu tiêu biểu do hệ thống tổng hợp)
															</p>
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</article>
						);
					})}

					{/* Pagination Footer */}
					{!embedded && totalPages > 1 && (
						<footer className="flex items-center justify-between rounded-xl border border-[#dfe8df] bg-white px-4 py-3 sm:px-6">
							<span className="text-xs text-[#53674d]">
								Hiển thị trang {page}/{totalPages} (tổng cộng {total} cung đường)
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage(page - 1)}
									className="rounded-lg border border-[#dfe8df] bg-white p-1.5 text-[#53674d] disabled:opacity-30 hover:bg-[#edf4e8]"
									aria-label="Trang trước"
								>
									<ChevronLeft className="size-4" />
								</button>
								<button
									type="button"
									disabled={page >= totalPages}
									onClick={() => setPage(page + 1)}
									className="rounded-lg border border-[#dfe8df] bg-white p-1.5 text-[#53674d] disabled:opacity-30 hover:bg-[#edf4e8]"
									aria-label="Trang tiếp"
								>
									<ChevronRight className="size-4" />
								</button>
							</div>
						</footer>
					)}
				</div>
			)}
		</div>
	);
}
