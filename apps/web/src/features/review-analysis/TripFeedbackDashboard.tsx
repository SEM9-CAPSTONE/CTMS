import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { aspectLabels, buttonClass, panelClass } from "./constants";
import { analysisService } from "./service";
import type { AspectType, TripFeedbackItem } from "./types";

interface TripFeedbackDashboardProps {
	actor: string;
	selectedTripId?: string;
	embedded?: boolean;
	onRouteResolved?: (routeId: string) => void;
}

export function TripFeedbackDashboard({
	actor,
	selectedTripId,
	embedded = false,
	onRouteResolved,
}: TripFeedbackDashboardProps) {
	const [page, setPage] = useState(1);

	const query = useQuery({
		queryKey: queryKeys.reviewAnalytics.tripsOverview(actor, page, selectedTripId),
		queryFn: ({ signal }) =>
			analysisService.tripFeedbackOverview(
				{
					tripId: selectedTripId || undefined,
					page,
					limit: 6,
				},
				signal
			),
		retry: false,
	});

	useEffect(() => {
		const firstRouteId = query.data?.items[0]?.routeId;
		if (firstRouteId && onRouteResolved) {
			onRouteResolved(firstRouteId);
		}
	}, [query.data, onRouteResolved]);

	const items = query.data?.items ?? [];
	const total = query.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / 6));

	return (
		<div className="space-y-4">
			{/* Overview Header Note */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-bold text-[#10221b]">
						{embedded ? "Khía cạnh trải nghiệm" : "Phản hồi chuyến đi"}
					</h2>
				</div>
			</div>

			{query.isPending ? (
				<div
					className={`${panelClass} flex items-center justify-center ${embedded ? "py-10" : "py-20"} text-[#53674d]`}
				>
					<Loader2 className="mr-3 size-6 animate-spin text-[#164027]" />
					<span className="text-sm font-medium">Đang tải phản hồi chuyến đi…</span>
				</div>
			) : query.isError ? (
				<div role="alert" className={`${panelClass} text-center py-12`}>
					<AlertCircle className="mx-auto mb-3 size-10 text-rose-600" />
					<h3 className="text-base font-semibold text-[#10221b]">
						Không thể tải phản hồi chuyến đi
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
					<Sparkles className="mx-auto mb-3 size-8 text-[#8a9d7a]" />
					<h3 className="font-semibold text-[#10221b]">Chưa có dữ liệu phản hồi chuyến đi</h3>
					<p className="mx-auto mt-1 max-w-md text-sm text-[#728070]">
						{embedded
							? "Khi có đánh giá hoàn tất phân tích AI, 4 khía cạnh trải nghiệm của chuyến đi sẽ được tổng hợp tại đây."
							: "Khi có đánh giá công khai hoàn tất phân tích AI, các khía cạnh trải nghiệm sẽ được tổng hợp tại đây."}
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{items.map((trip: TripFeedbackItem) => {
						const aspectKeys: AspectType[] = ["safety", "guide_support", "equipment", "value"];

						return (
							<article
								key={trip.tripId}
								className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs"
							>
								{/* Trip header */}
								{(!embedded ||
									!trip.hasSufficientSample ||
									trip.reportedReviewsExcludedCount > 0) && (
									<header className="border-b border-[#dfe8df] bg-[#f9faf8] px-4 py-3.5 sm:px-5">
										<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
											<div>
												{!embedded && (
													<h3 className="text-base font-bold text-[#10221b]">{trip.tripTitle}</h3>
												)}
												{!embedded && (
													<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#53674d]">
														<span>
															Tổng đánh giá hợp lệ:{" "}
															<strong className="text-[#10221b]">{trip.totalReviews}</strong>
														</span>
														<span>•</span>
														<span>
															Đã phân tích:{" "}
															<strong className="text-[#10221b]">
																{trip.analyzedReviewsCount}
															</strong>
														</span>
														<span>•</span>
														<span>
															Độ bao phủ:{" "}
															<strong className="text-[#10221b]">
																{Math.round(trip.coverageRate * 100)}%
															</strong>
														</span>
													</div>
												)}
												{trip.reportedReviewsExcludedCount > 0 && (
													<p className="text-xs text-amber-800">
														Đã loại trừ {trip.reportedReviewsExcludedCount} đánh giá đang bị báo cáo
														vi phạm khỏi điểm tổng hợp.
													</p>
												)}
											</div>

											{!trip.hasSufficientSample && (
												<span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 sm:self-auto">
													<Info className="size-3.5" />
													Chưa có đánh giá
												</span>
											)}
										</div>

										{!trip.hasSufficientSample && (
											<p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
												Chuyến đi này chưa có đánh giá nào để phân tích khía cạnh trải nghiệm.
											</p>
										)}
									</header>
								)}

								{/* Aspect Cards Grid */}
								<div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
									{aspectKeys.map((key) => {
										const aspect = trip.aspects[key];
										const totalMentions = aspect.positive + aspect.neutral + aspect.negative;

										return (
											<div
												key={key}
												id={key === "safety" ? "aspect-card-safety" : undefined}
												className="flex flex-col rounded-xl border border-[#e3ebe3] bg-[#fcfdfb] p-4 transition-colors duration-200 hover:bg-[#f7faf6]"
											>
												<div className="flex items-start justify-between gap-2">
													<span className="text-xs font-semibold tracking-wide text-[#53674d]">
														{aspectLabels[key]}
													</span>
													<span className="rounded-md bg-[#edf4e8] px-2 py-0.5 text-xs font-bold text-[#164027]">
														{totalMentions} lượt
													</span>
												</div>

												{/* Proportional Stacked Bar */}
												<div className="my-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-[#f0f3ed]">
													{totalMentions > 0 && aspect.positive > 0 && (
														<div
															className="h-full bg-[#164027] transition-all"
															style={{ width: `${(aspect.positive / totalMentions) * 100}%` }}
														/>
													)}
													{totalMentions > 0 && aspect.neutral > 0 && (
														<div
															className="h-full bg-[#94a393] transition-all"
															style={{ width: `${(aspect.neutral / totalMentions) * 100}%` }}
														/>
													)}
													{totalMentions > 0 && aspect.negative > 0 && (
														<div
															className="h-full bg-[#c76d5e] transition-all"
															style={{ width: `${(aspect.negative / totalMentions) * 100}%` }}
														/>
													)}
												</div>

												{/* Sentiment Counts Breakdown */}
												<div className="mt-auto space-y-1.5 text-xs">
													<div className="flex items-center justify-between">
														<span className="flex items-center gap-1.5 text-[#164027]">
															<span className="size-2 rounded-full bg-[#164027]" />
															Tích cực
														</span>
														<span className="font-semibold text-[#164027]">{aspect.positive}</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="flex items-center gap-1.5 text-[#556354]">
															<span className="size-2 rounded-full bg-[#94a393]" />
															Trung lập
														</span>
														<span className="font-semibold text-[#3f4b3e]">{aspect.neutral}</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="flex items-center gap-1.5 text-[#9c4538]">
															<span className="size-2 rounded-full bg-[#c76d5e]" />
															Tiêu cực
														</span>
														<span className="font-semibold text-[#8b3a2e]">{aspect.negative}</span>
													</div>

													{trip.hasSufficientSample && aspect.netScore !== null && (
														<div className="mt-2.5 flex items-center justify-between border-t border-[#e3ebe3] pt-2">
															<span className="text-[11px] font-medium text-[#53674d]">
																Tỷ lệ tích cực
															</span>
															<span className="text-xs font-bold text-[#164027]">
																{aspect.netScore <= 1
																	? Math.round(aspect.netScore * 100)
																	: Math.round(aspect.netScore)}
																%
															</span>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</article>
						);
					})}

					{/* Pagination */}
					{!embedded && totalPages > 1 && (
						<footer className="flex items-center justify-between rounded-xl border border-[#dfe8df] bg-white px-4 py-3 sm:px-6">
							<span className="text-xs text-[#53674d]">
								Hiển thị trang {page}/{totalPages} (tổng cộng {total} chuyến đi)
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
