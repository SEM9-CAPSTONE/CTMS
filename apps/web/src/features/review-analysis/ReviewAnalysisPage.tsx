import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	MessageSquareText,
	RefreshCw,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { AnalysisToolbar } from "./AnalysisToolbar";
import { BatchProgress } from "./BatchProgress";
import { InsightCard } from "./InsightCard";
import { InsightOverview } from "./InsightOverview";
import { ModerationQueueTable } from "./ModerationQueueTable";
import { RouteSafetyDashboard } from "./RouteSafetyDashboard";
import { TripFeedbackDashboard } from "./TripFeedbackDashboard";
import { buttonClass, panelClass, sentimentLabels } from "./constants";
import { analysisService } from "./service";
import type { ReviewAnalysisTab, SentimentFilter } from "./types";
import { friendlyError, useReviewAnalysis } from "./useReviewAnalysis";

export function ReviewAnalysisPage({
	actor,
	initialTripId = "",
}: { actor: string; initialTripId?: string }) {
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<ReviewAnalysisTab>("insights");
	const [tripId, setTripId] = useState(initialTripId);
	const [page, setPage] = useState(1);
	const [sentiment, setSentiment] = useState<SentimentFilter>("all");
	const resultsRef = useRef<HTMLDivElement>(null);
	const [resultHeight, setResultHeight] = useState(0);

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

	// Server-driven badge count for moderation queue
	const pendingCountQuery = useQuery({
		queryKey: queryKeys.reviewModeration.pendingBadge(actor),
		queryFn: async ({ signal }) => {
			const res = await analysisService.moderationQueue(
				{ status: "pending_review", limit: 1 },
				signal
			);
			return res.total;
		},
		staleTime: 10000,
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
		if (!tripId || tab !== "insights") return;
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
	}, [tripId, tab]);

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (!el) return;
		setActiveSection(id);
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="sticky top-0 z-30 border-b border-[#dfe8df] bg-white/95 backdrop-blur-sm shadow-2xs">
				<div className="mx-auto flex min-h-20 max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:h-20 lg:py-0">
					<div className="hidden rounded-xl bg-emerald-50 p-3 text-[#164027] sm:block">
						<MessageSquareText className="size-6" />
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="text-xl font-extrabold sm:text-2xl">Phân tích đánh giá</h1>
						<p className="mt-0.5 text-sm text-[#667a6d]">
							Tổng hợp cảm nhận, kiểm duyệt vi phạm và báo cáo an toàn từ đánh giá chuyến đi.
						</p>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
				{/* 2 Feature Tabs: Phân tích chuyến đi (tổng hợp dashboard) & Hàng đợi kiểm duyệt */}
				<nav
					role="tablist"
					aria-label="Phân hệ phân tích đánh giá"
					className="flex flex-wrap items-center gap-2 border-b border-[#dfe8df] pb-3"
				>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "insights"}
						onClick={() => setTab("insights")}
						className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
							tab === "insights"
								? "border-[#164027] bg-[#164027] text-white shadow-xs"
								: "border-[#dfe8df] bg-white text-[#53674d] hover:bg-[#edf4e8]"
						}`}
					>
						<Sparkles className="size-4" />
						<span>Phân tích chuyến đi</span>
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={tab === "moderation_queue"}
						onClick={() => setTab("moderation_queue")}
						className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
							tab === "moderation_queue"
								? "border-[#164027] bg-[#164027] text-white shadow-xs"
								: "border-[#dfe8df] bg-white text-[#53674d] hover:bg-[#edf4e8]"
						}`}
					>
						<ShieldAlert className="size-4" />
						<span>Hàng đợi kiểm duyệt</span>
						{(pendingCountQuery.data ?? 0) > 0 && (
							<span
								className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
									tab === "moderation_queue"
										? "bg-white/20 text-white"
										: "bg-rose-100 text-rose-800"
								}`}
							>
								{pendingCountQuery.data}
							</span>
						)}
					</button>
				</nav>

				{/* TAB 1: INSIGHTS & TOPICS */}
				{tab === "insights" && (
					<>
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
						<p className="px-1 text-xs leading-5 text-[#667a6d]">
							Kết quả do AI tạo, không thay thế điểm sao và không ảnh hưởng điểm uy tín. Đánh giá
							gốc luôn được giữ nguyên.
						</p>
						{!tripId ? (
							<section className={`${panelClass} py-14 text-center`}>
								<Sparkles className="mx-auto mb-4 size-8 text-[#8a9d7a]" />
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
											<div className="sticky top-20 z-20 -mx-4 mb-4 border-b border-[#dfe8df] bg-[#f6f8f6]/95 px-4 py-2.5 shadow-2xs backdrop-blur-xs">
												<div className="flex items-center gap-2 overflow-x-auto px-1 no-scrollbar">
													{SECTIONS.map((sec) => (
														<button
															key={sec.id}
															type="button"
															onClick={() => scrollToSection(sec.id)}
															className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition ${
																activeSection === sec.id
																	? "bg-[#164027] text-white shadow-2xs"
																	: "border border-[#dfe8df] bg-white text-[#374151] hover:bg-[#edf4e8]"
															}`}
														>
															{sec.label}
														</button>
													))}
												</div>
											</div>

											{state.batch.isError && (
												<p
													role="alert"
													className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
												>
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
														disabled={
															state.waitSeconds > 0 || state.running || state.create.isPending
														}
														onClick={() => state.submit()}
														className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
													>
														<RefreshCw
															className={`size-3.5 ${state.running ? "animate-spin" : ""}`}
														/>
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
														<p className="mt-1 text-xs text-[#4b5563]">
															Chỉ tổng hợp kết quả từ phiên bản đánh giá mới nhất, còn đủ điều kiện
															phân tích.
														</p>
													</div>
												</div>

												<fieldset className="flex flex-wrap gap-2" aria-label="Lọc theo cảm nhận">
													{(["all", "positive", "neutral", "negative", "mixed"] as const).map(
														(value) => (
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
																<span className="ml-1 opacity-75">
																	{value === "all"
																		? data.coverage.analyzed
																		: data.sentimentCounts[value]}
																</span>
															</button>
														)
													)}
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
																item={item}
																index={
																	(data.pagination.page - 1) * data.pagination.limit + index + 1
																}
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
																	({data.coverage.stale} đánh giá đã sửa nội dung, đang chờ phân
																	tích lại)
																</span>
															)}
														</p>
														{data.pagination.totalPages > 1 && (
															<nav
																aria-label="Phân trang kết quả"
																className="flex items-center gap-2"
															>
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
					</>
				)}

				{/* TAB 2: MODERATION QUEUE */}
				{tab === "moderation_queue" && (
					<ModerationQueueTable
						actor={actor}
						selectedTripId=""
						trips={
							trips.data
								? [
										...new Map(
											trips.data.pages.flatMap((p) => p.items).map((t) => [t.id, t])
										).values(),
									]
								: undefined
						}
						onPendingCountChange={() => {
							void pendingCountQuery.refetch();
						}}
					/>
				)}

				{/* TAB 3: TRIP FEEDBACK DASHBOARD */}
				{tab === "trip_feedback" && (
					<TripFeedbackDashboard actor={actor} selectedTripId={tripId || undefined} />
				)}

				{/* TAB 4: ROUTE SAFETY DASHBOARD */}
				{tab === "route_safety" && <RouteSafetyDashboard actor={actor} />}
			</div>
		</div>
	);
}
