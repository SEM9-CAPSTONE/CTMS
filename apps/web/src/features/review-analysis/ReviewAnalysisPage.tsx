import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { AnalysisToolbar } from "./AnalysisToolbar";
import { BatchProgress } from "./BatchProgress";
import { InsightCard } from "./InsightCard";
import { InsightOverview } from "./InsightOverview";
import { ModerationDecisionDialog } from "./ModerationDecisionDialog";
import { RouteSafetyDashboard } from "./RouteSafetyDashboard";
import { TripFeedbackDashboard } from "./TripFeedbackDashboard";
import { buttonClass, panelClass, secondaryButtonClass, sentimentLabels } from "./constants";
import { analysisService } from "./service";
import type { SentimentFilter } from "./types";
import { friendlyError, useReviewAnalysis } from "./useReviewAnalysis";

export function ReviewAnalysisPage({
	actor,
	initialTripId = "",
	initialReviewId = "",
}: { actor: string; initialTripId?: string; initialReviewId?: string }) {
	const queryClient = useQueryClient();
	const [tripId, setTripId] = useState(initialTripId);
	const [activeReviewId, setActiveReviewId] = useState(
		() => initialReviewId || new URLSearchParams(window.location.search).get("reviewId") || ""
	);
	const [page, setPage] = useState(1);
	const [sentiment, setSentiment] = useState<SentimentFilter>("all");
	const resultsRef = useRef<HTMLDivElement>(null);
	const [resultHeight, setResultHeight] = useState(0);

	useEffect(() => {
		if (initialReviewId) {
			setActiveReviewId(initialReviewId);
		}
	}, [initialReviewId]);

	const closeModerationModal = () => {
		setActiveReviewId("");
		const url = new URL(window.location.href);
		url.searchParams.delete("reviewId");
		window.history.replaceState(window.history.state, "", url);
	};

	const changePage = (next: number) => {
		setResultHeight(resultsRef.current?.getBoundingClientRect().height ?? 0);
		setPage(next);
	};

	const trips = useInfiniteQuery({
		queryKey: [...queryKeys.reviewAnalysis.trips(actor, 0), "infinite"],
		initialPageParam: 1,
		queryFn: ({ signal, pageParam }) => analysisService.trips(pageParam, signal),
		getNextPageParam: (last) =>
			last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
		retry: false,
	});

	const moderationDetailQuery = useQuery({
		queryKey: queryKeys.reviewModeration.detail(actor, activeReviewId),
		queryFn: ({ signal }) => analysisService.moderationDetail(activeReviewId, signal),
		enabled: activeReviewId.length > 0,
		retry: false,
	});

	const state = useReviewAnalysis(actor, tripId, page, sentiment);
	const data = state.insights.isError ? undefined : state.insights.data;

	const [resolvedRouteId, setResolvedRouteId] = useState<string | undefined>();

	const choose = (id: string) => {
		setTripId(id);
		setResolvedRouteId(undefined);
		setSentiment("all");
		setPage(1);
		setResultHeight(0);
		state.create.reset();
		const url = new URL(window.location.href);
		if (id) url.searchParams.set("trip", id);
		else url.searchParams.delete("trip");
		window.history.replaceState(window.history.state, "", url);
	};

	const remaining =
		state.batch.data?.remainingCount ??
		(data ? data.coverage.unprocessed + data.coverage.stale : 0);

	const canCreate =
		!!data &&
		!state.insights.isPlaceholderData &&
		!state.running &&
		!state.create.isPending &&
		!state.waitSeconds &&
		remaining > 0;

	const SECTIONS = [
		{ id: "section-overview", label: "Tổng quan" },
		{ id: "section-aspects", label: "Khía cạnh trải nghiệm" },
		{ id: "section-safety", label: "Tín hiệu an toàn" },
		{ id: "section-reviews", label: "Từng đánh giá" },
	] as const;

	const [activeSection, setActiveSection] = useState<string>("section-overview");

	useEffect(() => {
		if (!tripId) return;
		const sectionIds = ["section-overview", "section-aspects", "section-safety", "section-reviews"];

		let ticking = false;
		const handleScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					let current = sectionIds[0];
					for (const id of sectionIds) {
						const el = document.getElementById(id);
						if (el) {
							const rect = el.getBoundingClientRect();
							// Threshold around ~160px accommodates sticky nav and breathing space
							if (rect.top <= 160) {
								current = id;
							}
						}
					}
					// If user reached bottom of page, highlight the last section
					if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
						current = sectionIds[sectionIds.length - 1];
					}
					setActiveSection(current);
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
		return () => window.removeEventListener("scroll", handleScroll);
	}, [tripId]);

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (!el) return;
		setActiveSection(id);
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
	};

	return (
		<div className="min-h-screen bg-[#f6f8f5] text-[#10221b]">
			<header className="sticky top-[65px] z-30 border-b border-[#dfe8df] bg-white/95 backdrop-blur-sm lg:top-0">
				<div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:h-20 lg:py-0">
					<div className="min-w-0">
						<h1 className="text-xl font-extrabold tracking-tight text-[#10221b] sm:text-2xl">
							Phân tích đánh giá
						</h1>
						<p className="mt-0.5 text-sm text-[#667a6d]">
							Tổng hợp cảm nhận, khía cạnh trải nghiệm và tín hiệu an toàn từ đánh giá chuyến đi.
						</p>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
				<AnalysisToolbar
					trips={
						trips.data
							? {
									items: [
										...new Map(
											trips.data.pages.flatMap((p) => p.items).map((t) => [t.id, t])
										).values(),
									],
									pagination: trips.data.pages[0].pagination,
								}
							: undefined
					}
					loading={trips.isPending}
					error={trips.isError ? friendlyError(trips.error) : null}
					tripId={tripId}
					canLoadMoreTrips={!!trips.hasNextPage}
					loadingMoreTrips={trips.isFetchingNextPage}
					busy={state.create.isPending}
					running={state.running}
					refreshing={state.insights.isFetching}
					waitSeconds={state.waitSeconds}
					canCreate={canCreate}
					hasMore={!!state.batch.data?.hasMore}
					onChoose={choose}
					onLoadMoreTrips={() => {
						void trips.fetchNextPage();
					}}
					onRetry={() => {
						void trips.refetch();
					}}
					onRefresh={() => {
						void state.insights.refetch();
						if (state.batch.data) void state.batch.refetch();
						void queryClient.invalidateQueries({ queryKey: ["review-analytics"] });
					}}
					onCreate={state.submit}
				/>
				{!tripId ? (
					<section className={`${panelClass} py-14 text-center`}>
						<h2 className="font-semibold">Mỗi nhận xét là một góc nhìn</h2>
						<p className="mt-2 text-sm text-[#728070]">
							Chọn chuyến đi để xem kết quả phân tích đánh giá.
						</p>
					</section>
				) : (
					<>
						{state.create.isError && (
							<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
								{friendlyError(state.create.error)}
							</p>
						)}
						{state.insights.isPending ? (
							<output
								className={`${panelClass} block animate-pulse py-16 text-center text-sm text-[#728070]`}
							>
								Đang tải phân tích chuyến đi…
							</output>
						) : state.insights.isError ? (
							<section role="alert" className={panelClass}>
								<h2 className="font-semibold">Không thể mở phân tích</h2>
								<p className="mt-2 text-sm">{friendlyError(state.insights.error)}</p>
								<button
									type="button"
									className={`${buttonClass} mt-4`}
									onClick={() => state.insights.refetch()}
								>
									Thử lại
								</button>
							</section>
						) : (
							data && (
								<>
									{/* Sticky Mini-Nav Bar for fast section jumping */}
									<div className="sticky top-[145px] z-20 rounded-2xl border border-[#dfe8df] bg-white/95 px-3 py-2 shadow-2xs backdrop-blur-xs lg:top-20">
										<div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
											{SECTIONS.map((sec) => (
												<button
													key={sec.id}
													type="button"
													onClick={() => scrollToSection(sec.id)}
													className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
														activeSection === sec.id
															? "bg-[#164027] text-white shadow-2xs"
															: "text-[#374151] hover:bg-[#edf4e8]"
													}`}
												>
													{sec.label}
												</button>
											))}
										</div>
									</div>

									{state.batch.isError && (
										<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
											Chưa cập nhật được tiến độ. {friendlyError(state.batch.error)}
										</p>
									)}
									{state.batch.data && <BatchProgress data={state.batch.data} />}

									{/* Re-analyze Stale Reviews Banner with Cooldown Countdown */}
									{data.coverage.stale > 0 && (
										<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-950 sm:text-sm">
											<div className="flex items-center gap-2.5">
												<RefreshCw
													className={`size-4 text-amber-800 ${state.running ? "animate-spin" : ""}`}
												/>
												<span>
													Có <strong>{data.coverage.stale}</strong> đánh giá đã sửa nội dung cần
													được phân tích lại (kết quả cũ đã tạm loại khỏi tổng hợp).
												</span>
											</div>
											<button
												type="button"
												disabled={state.waitSeconds > 0 || state.running || state.create.isPending}
												onClick={() => state.submit()}
												className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<RefreshCw className={`size-3.5 ${state.running ? "animate-spin" : ""}`} />
												<span>
													{state.running || state.create.isPending
														? "Đang phân tích lại…"
														: state.waitSeconds > 0
															? `Chờ ${state.waitSeconds}s để phân tích lại`
															: `Phân tích lại (${data.coverage.stale} đánh giá)`}
												</span>
											</button>
										</div>
									)}

									<div id="section-overview" className="scroll-mt-36 space-y-4">
										<InsightOverview data={data} />
									</div>

									<div id="section-aspects" className="scroll-mt-36">
										<TripFeedbackDashboard
											actor={actor}
											selectedTripId={tripId}
											onRouteResolved={setResolvedRouteId}
											embedded
										/>
									</div>

									<div id="section-safety" className="scroll-mt-36">
										<RouteSafetyDashboard
											actor={actor}
											selectedRouteId={
												trips.data?.pages.flatMap((p) => p.items).find((t) => t.id === tripId)
													?.routeId ?? resolvedRouteId
											}
											embedded
										/>
									</div>

									<div id="section-reviews" className="scroll-mt-36 space-y-4">
										<div className="flex flex-wrap items-end justify-between gap-3 pt-2">
											<div>
												<h2 className="text-xl font-semibold text-[#10221b]">
													Phân tích từng đánh giá
												</h2>
											</div>
										</div>

										<fieldset className="flex flex-wrap gap-2" aria-label="Lọc theo cảm nhận">
											{(["all", "positive", "neutral", "negative"] as const).map((value) => {
												const count =
													value === "all"
														? data.coverage.analyzed
														: value === "neutral"
															? (data.sentimentCounts.neutral || 0) +
																(data.sentimentCounts.mixed || 0)
															: data.sentimentCounts[value];
												return (
													<button
														type="button"
														key={value}
														aria-pressed={sentiment === value}
														onClick={() => {
															setSentiment(value);
															setPage(1);
														}}
														className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
															sentiment === value
																? "border-[#164027] bg-[#164027] text-white"
																: "border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8]"
														}`}
													>
														{value === "all" ? "Tất cả" : sentimentLabels[value]}{" "}
														<span className="ml-1 opacity-75">{count}</span>
													</button>
												);
											})}
										</fieldset>

										{data.items.length === 0 ? (
											<section className={`${panelClass} py-12 text-center`}>
												<h3 className="font-semibold text-[#10221b]">
													{sentiment !== "all"
														? `Chưa có kết quả thuộc nhóm ${sentimentLabels[sentiment].toLowerCase()}`
														: data.coverage.eligible === 0
															? "Chưa có đánh giá đủ điều kiện"
															: data.coverage.pending > 0
																? "Đang chuẩn bị kết quả phân tích"
																: data.coverage.stale > 0
																	? "Kết quả trước đây cần được cập nhật"
																	: "Chưa có kết quả phân tích"}
												</h3>
												<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#4b5563]">
													{data.coverage.eligible === 0
														? "Nhận xét chuyến đi phải đáp ứng điều kiện tham gia và kiểm duyệt trước khi được phân tích."
														: "Bạn có thể bắt đầu phân tích các nhận xét đủ điều kiện. Đánh giá gốc không thay đổi."}
												</p>
											</section>
										) : (
											<div
												ref={resultsRef}
												aria-busy={state.insights.isFetching}
												style={{ minHeight: resultHeight || undefined }}
												className={`grid content-start items-stretch gap-3 lg:grid-cols-2 ${
													state.insights.isPlaceholderData ? "opacity-60" : ""
												}`}
											>
												{data.items.map((item, index) => (
													<InsightCard
														key={item.id}
														actor={actor}
														tripId={tripId}
														tripTitle={
															trips.data?.pages
																.flatMap((entry) => entry.items)
																.find((trip) => trip.id === tripId)?.title
														}
														item={item}
														index={(data.pagination.page - 1) * data.pagination.limit + index + 1}
													/>
												))}
											</div>
										)}

										{data.pagination.total > 0 && (
											<div className="flex flex-col items-center justify-between gap-3 pt-2 pb-8 sm:flex-row">
												<p className="text-xs font-medium text-[#374151]">
													Hiển thị{" "}
													{Math.min(
														data.pagination.total,
														(data.pagination.page - 1) * data.pagination.limit + 1
													)}{" "}
													-{" "}
													{Math.min(
														data.pagination.page * data.pagination.limit,
														data.pagination.total
													)}{" "}
													/{" "}
													<span className="font-semibold text-[#164027]">
														{data.pagination.total}
													</span>{" "}
													đánh giá đã phân tích
													{data.coverage.stale > 0 && sentiment === "all" && (
														<span className="ml-1 text-[#4b5563]">
															({data.coverage.stale} đánh giá đã sửa nội dung, đang chờ phân tích
															lại)
														</span>
													)}
												</p>
												{data.pagination.totalPages > 1 && (
													<nav aria-label="Phân trang kết quả" className="flex items-center gap-2">
														<button
															type="button"
															className="rounded-xl border border-[#dfe8df] bg-white p-2 text-[#374151] hover:bg-[#edf4e8] disabled:opacity-30"
															aria-label="Trang kết quả trước"
															disabled={page === 1 || state.insights.isPlaceholderData}
															onClick={() => changePage(page - 1)}
														>
															<ChevronLeft className="size-4" />
														</button>
														<div className="flex items-center gap-1">
															{Array.from(
																{ length: data.pagination.totalPages },
																(_, i) => i + 1
															).map((p) => (
																<button
																	key={p}
																	type="button"
																	aria-current={p === page ? "page" : undefined}
																	disabled={state.insights.isPlaceholderData}
																	onClick={() => changePage(p)}
																	className={`size-8 rounded-lg text-xs font-semibold transition ${
																		p === page
																			? "bg-[#164027] text-white shadow-2xs"
																			: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8]"
																	}`}
																>
																	{p}
																</button>
															))}
														</div>
														<span className="sr-only">
															Trang {data.pagination.page}/{data.pagination.totalPages}
														</span>
														{state.insights.isPlaceholderData && (
															<output className="px-1 text-xs text-[#4b5563]">Đang tải…</output>
														)}
														<button
															type="button"
															className="rounded-xl border border-[#dfe8df] bg-white p-2 text-[#374151] hover:bg-[#edf4e8] disabled:opacity-30"
															aria-label="Trang kết quả tiếp"
															disabled={
																page >= data.pagination.totalPages ||
																state.insights.isPlaceholderData
															}
															onClick={() => changePage(page + 1)}
														>
															<ChevronRight className="size-4" />
														</button>
													</nav>
												)}
											</div>
										)}
									</div>
								</>
							)
						)}
					</>
				)}
			</div>

			{activeReviewId && moderationDetailQuery.isPending && (
				// biome-ignore lint/a11y/useSemanticElements: custom accessible dialog backdrop
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Đang tải chi tiết đánh giá"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
				>
					<div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 text-sm font-medium text-[#10221b] shadow-lg">
						<Loader2 className="size-5 animate-spin text-[#164027]" />
						<span>Đang tải chi tiết đánh giá từ thông báo…</span>
					</div>
				</div>
			)}

			{activeReviewId && moderationDetailQuery.isError && (
				// biome-ignore lint/a11y/useSemanticElements: custom accessible dialog backdrop
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Không tải được chi tiết đánh giá"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
				>
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
						<div className="flex items-center justify-between">
							<h2 className="text-base font-bold text-[#10221b]">Không mở được đánh giá</h2>
							<button
								type="button"
								onClick={closeModerationModal}
								aria-label="Đóng"
								className="rounded-lg p-1.5 text-[#53674d] hover:bg-[#f0f5ed]"
							>
								<X className="size-5" />
							</button>
						</div>
						<p className="mt-2 text-sm text-[#53674d]">
							{friendlyError(moderationDetailQuery.error)}
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={closeModerationModal} className={secondaryButtonClass}>
								Đóng
							</button>
							<button
								type="button"
								onClick={() => void moderationDetailQuery.refetch()}
								className={buttonClass}
							>
								Thử lại
							</button>
						</div>
					</div>
				</div>
			)}

			{activeReviewId && moderationDetailQuery.data && (
				<ModerationDecisionDialog
					item={moderationDetailQuery.data}
					onClose={closeModerationModal}
					onSuccess={() => {
						void queryClient.invalidateQueries({ queryKey: ["review-analytics"] });
						void queryClient.invalidateQueries({ queryKey: queryKeys.reviewModeration.all });
						void state.insights.refetch();
						closeModerationModal();
					}}
				/>
			)}
		</div>
	);
}
