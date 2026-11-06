import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MessageSquareText, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { AnalysisToolbar } from "./AnalysisToolbar";
import { BatchProgress } from "./BatchProgress";
import { InsightCard } from "./InsightCard";
import { InsightOverview } from "./InsightOverview";
import { buttonClass, panelClass, sentimentLabels } from "./constants";
import { analysisService } from "./service";
import type { SentimentFilter } from "./types";
import { friendlyError, useReviewAnalysis } from "./useReviewAnalysis";

export function ReviewAnalysisPage({
	actor,
	initialTripId = "",
}: { actor: string; initialTripId?: string }) {
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
	const state = useReviewAnalysis(actor, tripId, page, sentiment);
	const data = state.insights.isError ? undefined : state.insights.data;
	const choose = (id: string) => {
		setTripId(id);
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
	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b border-[#dfe8df] bg-white">
				<div className="mx-auto flex min-h-20 max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:h-20 lg:py-0">
					<div className="hidden rounded-xl bg-emerald-50 p-3 text-[#164027] sm:block">
						<MessageSquareText className="size-6" />
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="text-xl font-extrabold sm:text-2xl">Phân tích đánh giá</h1>
						<p className="mt-0.5 text-sm text-[#667a6d]">
							Tổng hợp cảm nhận và chủ đề từ đánh giá chuyến đi.
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
					}}
					onCreate={state.submit}
				/>
				<p className="px-1 text-xs leading-5 text-[#667a6d]">
					Kết quả do AI tạo, không thay thế điểm sao và không ảnh hưởng điểm uy tín. Đánh giá gốc
					luôn được giữ nguyên.
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
									{state.batch.isError && (
										<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
											Chưa cập nhật được tiến độ. {friendlyError(state.batch.error)}
										</p>
									)}
									{state.batch.data && <BatchProgress data={state.batch.data} />}
									<InsightOverview data={data} />
									<div className="flex flex-wrap items-end justify-between gap-3">
										<div>
											<h2 className="text-xl font-semibold">Phân tích từng đánh giá</h2>
											<p className="mt-1 text-xs text-[#728070]">
												Chỉ tổng hợp kết quả từ phiên bản đánh giá mới nhất, còn đủ điều kiện phân
												tích.
											</p>
										</div>
									</div>

									<fieldset className="flex flex-wrap gap-2" aria-label="Lọc theo cảm nhận">
										{(["all", "positive", "neutral", "negative", "mixed"] as const).map((value) => (
											<button
												type="button"
												key={value}
												aria-pressed={sentiment === value}
												onClick={() => {
													setSentiment(value);
													setPage(1);
												}}
												className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${sentiment === value ? "border-[#164027] bg-[#164027] text-white" : "border-[#dfe8df] bg-white text-[#53674d] hover:bg-[#edf4e8]"}`}
											>
												{value === "all" ? "Tất cả" : sentimentLabels[value]}{" "}
												<span className="ml-1 opacity-75">
													{value === "all" ? data.coverage.analyzed : data.sentimentCounts[value]}
												</span>
											</button>
										))}
									</fieldset>

									{data.items.length === 0 ? (
										<section className={`${panelClass} py-12 text-center`}>
											<h3 className="font-semibold">
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
											<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#728070]">
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
											className={`grid content-start items-stretch gap-3 lg:grid-cols-2 ${state.insights.isPlaceholderData ? "opacity-60" : ""}`}
										>
											{data.items.map((item, index) => (
												<InsightCard
													key={item.id}
													actor={actor}
													tripId={tripId}
													item={item}
													index={(data.pagination.page - 1) * data.pagination.limit + index + 1}
												/>
											))}
										</div>
									)}
									{data.pagination.totalPages > 1 && (
										<nav
											aria-label="Phân trang kết quả"
											className="flex items-center justify-center gap-4"
										>
											<button
												type="button"
												className="rounded-xl border p-2 disabled:opacity-30"
												aria-label="Trang kết quả trước"
												disabled={page === 1 || state.insights.isPlaceholderData}
												onClick={() => changePage(page - 1)}
											>
												<ChevronLeft className="size-4" />
											</button>
											<span className="text-sm">
												Trang {data.pagination.page}/{data.pagination.totalPages}
												{state.insights.isPlaceholderData && (
													<output className="ml-2 text-xs text-[#728070]">Đang tải…</output>
												)}
											</span>
											<button
												type="button"
												className="rounded-xl border p-2 disabled:opacity-30"
												aria-label="Trang kết quả tiếp"
												disabled={
													page >= data.pagination.totalPages || state.insights.isPlaceholderData
												}
												onClick={() => changePage(page + 1)}
											>
												<ChevronRight className="size-4" />
											</button>
										</nav>
									)}
								</>
							)
						)}
					</>
				)}
			</div>
		</div>
	);
}
