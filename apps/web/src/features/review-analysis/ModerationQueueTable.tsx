import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Image as ImageIcon,
	Loader2,
	RefreshCw,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { ModerationDecisionDialog } from "./ModerationDecisionDialog";
import { QuarantinedImageModal } from "./QuarantinedImageModal";
import {
	buttonClass,
	detectionSourceLabels,
	moderationFlagLabels,
	moderationQueueFilterLabels,
	panelClass,
	secondaryButtonClass,
} from "./constants";
import { analysisService } from "./service";
import type { ModerationQueueItem } from "./types";

interface ModerationQueueTableProps {
	actor: string;
	selectedTripId?: string;
	trips?: Array<{ id: string; title?: string; name?: string }>;
	onPendingCountChange?: (count: number) => void;
}

export function ModerationQueueTable({
	actor,
	selectedTripId,
	trips,
	onPendingCountChange,
}: ModerationQueueTableProps) {
	const client = useQueryClient();
	const [status, setStatus] = useState<"pending_review" | "hidden" | "resolved">("pending_review");
	const [page, setPage] = useState(1);
	const [tripFilter, setTripFilter] = useState<string>(selectedTripId || "");

	const [inspectingImage, setInspectingImage] = useState<{
		reviewId: string;
		imageIndex: number;
	} | null>(null);

	const [activeDecisionItem, setActiveDecisionItem] = useState<ModerationQueueItem | null>(null);

	// Queue items query
	const queueQuery = useQuery({
		queryKey: queryKeys.reviewModeration.queue(actor, status, tripFilter || undefined, page),
		queryFn: async ({ signal }) => {
			const res = await analysisService.moderationQueue(
				{
					status,
					tripId: tripFilter || undefined,
					page,
					limit: 10,
				},
				signal
			);
			if (status === "pending_review" && onPendingCountChange && !tripFilter) {
				onPendingCountChange(res.total);
			}
			return res;
		},
		retry: false,
	});

	// Server pending count query for badge
	const pendingBadgeQuery = useQuery({
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

	const refreshData = () => {
		void queueQuery.refetch();
		void pendingBadgeQuery.refetch();
		void client.invalidateQueries({ queryKey: queryKeys.reviewModeration.all });
	};

	const items = queueQuery.data?.items ?? [];
	const total = queueQuery.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / 10));

	return (
		<div className="space-y-4">
			{/* Filter Tabs & Refresh Bar */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset className="flex flex-wrap gap-2" aria-label="Lọc trạng thái hàng đợi kiểm duyệt">
					{(["pending_review", "hidden", "resolved"] as const).map((filterValue) => {
						const isSelected = status === filterValue;
						const badgeCount =
							filterValue === "pending_review" ? (pendingBadgeQuery.data ?? 0) : null;

						return (
							<button
								type="button"
								key={filterValue}
								aria-pressed={isSelected}
								onClick={() => {
									setStatus(filterValue);
									setPage(1);
								}}
								className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
									isSelected
										? "border-[#164027] bg-[#164027] text-white shadow-xs"
										: "border-[#dfe8df] bg-white text-[#53674d] hover:bg-[#edf4e8]"
								}`}
							>
								<span>{moderationQueueFilterLabels[filterValue]}</span>
								{badgeCount !== null && (
									<span
										className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
											isSelected ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
										}`}
									>
										{badgeCount}
									</span>
								)}
							</button>
						);
					})}
				</fieldset>

				<div className="flex flex-wrap items-center gap-2">
					{trips && trips.length > 0 && (
						<select
							value={tripFilter}
							onChange={(e) => {
								setTripFilter(e.target.value);
								setPage(1);
							}}
							aria-label="Lọc hàng đợi theo chuyến đi"
							className="h-9 rounded-xl border border-[#dfe8df] bg-white px-3 text-xs font-medium text-[#10221b] focus:outline-[#164027]"
						>
							<option value="">Tất cả chuyến đi</option>
							{trips.map((t) => (
								<option key={t.id} value={t.id}>
									{t.title || t.name || t.id}
								</option>
							))}
						</select>
					)}

					<button
						type="button"
						onClick={refreshData}
						disabled={queueQuery.isFetching}
						className={secondaryButtonClass}
						aria-label="Làm mới hàng đợi"
					>
						<RefreshCw className={`size-4 ${queueQuery.isFetching ? "animate-spin" : ""}`} />
						<span className="hidden sm:inline">Làm mới</span>
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			{queueQuery.isPending ? (
				<div className={`${panelClass} flex items-center justify-center py-20 text-[#53674d]`}>
					<Loader2 className="mr-3 size-6 animate-spin text-[#164027]" />
					<span className="text-sm font-medium">Đang tải danh sách kiểm duyệt…</span>
				</div>
			) : queueQuery.isError ? (
				<div role="alert" className={`${panelClass} text-center py-12`}>
					<ShieldAlert className="mx-auto mb-3 size-10 text-rose-600" />
					<h3 className="text-base font-semibold text-[#10221b]">
						Không thể tải danh sách kiểm duyệt
					</h3>
					<p className="mt-1 text-sm text-[#728070]">
						Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.
					</p>
					<button
						type="button"
						onClick={() => queueQuery.refetch()}
						className={`${buttonClass} mt-4`}
					>
						Thử lại
					</button>
				</div>
			) : items.length === 0 ? (
				<div className={`${panelClass} py-16 text-center`}>
					<ShieldAlert className="mx-auto mb-3 size-10 text-[#8a9d7a]" />
					<h3 className="font-semibold text-[#10221b]">
						{status === "pending_review"
							? "Không có đánh giá nào cần xử lý vi phạm"
							: status === "hidden"
								? "Chưa có đánh giá nào bị ẩn"
								: "Chưa có lịch sử xử lý đánh giá"}
					</h3>
					<p className="mx-auto mt-1 max-w-md text-sm text-[#728070]">
						{tripFilter ? (
							<span>
								Chuyến đi này hiện không có đánh giá nào thuộc trạng thái này.{" "}
								<button
									type="button"
									onClick={() => {
										setTripFilter("");
										setPage(1);
									}}
									className="font-semibold text-[#164027] underline"
								>
									Xem tất cả chuyến đi
								</button>
							</span>
						) : status === "pending_review" ? (
							"Hệ thống tự động quét nhận xét và hình ảnh theo tiêu chuẩn cộng đồng. Khi phát hiện cờ vi phạm, đánh giá sẽ xuất hiện tại đây."
						) : (
							"Các quyết định xử lý hoặc phục hồi sẽ được lưu vết đầy đủ."
						)}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-[#10221b]">
							<thead className="border-b border-[#dfe8df] bg-[#f9faf8] text-xs font-semibold uppercase tracking-wider text-[#53674d]">
								<tr>
									<th scope="col" className="px-4 py-3 sm:px-6">
										Đánh giá & Chuyến đi
									</th>
									<th scope="col" className="px-4 py-3 sm:px-6">
										Cờ vi phạm & Bằng chứng
									</th>
									<th scope="col" className="px-4 py-3 sm:px-6">
										Hình ảnh
									</th>
									<th scope="col" className="px-4 py-3 text-right sm:px-6">
										Hành động
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#dfe8df]">
								{items.map((item) => {
									const hasQuarantinedImages =
										item.imageStorageState === "quarantined" &&
										item.images &&
										item.images.length > 0;

									const hasLiveImages =
										item.imageStorageState === "live" && item.images && item.images.length > 0;

									return (
										<tr key={item.reviewId} className="hover:bg-[#fcfdfb]">
											{/* Review & Trip Information */}
											<td className="max-w-xs px-4 py-4 align-top sm:px-6">
												<div className="space-y-1.5">
													<p className="font-semibold text-[#10221b]">{item.tripTitle}</p>
													<div className="flex items-center gap-2">
														<span className="font-bold text-amber-600">★ {item.rating}/5</span>
														<span className="text-xs text-[#728070]">
															Phiên bản #{item.sourceRevision}
														</span>
													</div>
													<p className="line-clamp-3 text-xs leading-5 text-[#53674d]">
														{item.comment ? (
															item.comment
														) : (
															<span className="italic text-[#8a9d7a]">
																(Không có nhận xét bằng chữ)
															</span>
														)}
													</p>
													<p className="text-[11px] text-[#728070]">
														{new Date(item.createdAt).toLocaleDateString("vi-VN", {
															year: "numeric",
															month: "short",
															day: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})}
													</p>
												</div>
											</td>

											{/* Moderation Flags & Evidence */}
											<td className="px-4 py-4 align-top sm:px-6">
												{item.activeFlags.length === 0 ? (
													<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
														Không có cờ vi phạm đang hoạt động
													</span>
												) : (
													<div className="space-y-2">
														{item.activeFlags.map((flag) => (
															<div
																key={flag.id}
																className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 text-xs"
															>
																<div className="flex flex-wrap items-center gap-2">
																	<span className="font-bold text-rose-900">
																		{moderationFlagLabels[flag.flagType] || flag.flagType}
																	</span>
																	<span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-rose-800 shadow-2xs">
																		{flag.channel === "text" ? "Văn bản" : "Hình ảnh"}
																	</span>
																	<span className="text-[11px] text-[#667a6d]">
																		Nguồn:{" "}
																		{detectionSourceLabels[flag.detectionSource] ||
																			flag.detectionSource}
																	</span>
																	{flag.confidence !== null && (
																		<span className="text-[11px] text-[#667a6d]">
																			Độ tin cậy: {Math.round(flag.confidence * 100)}%
																		</span>
																	)}
																</div>
																{flag.quote && (
																	<p className="mt-1.5 line-clamp-2 rounded-md bg-white/80 p-1.5 italic text-rose-950">
																		&ldquo;{flag.quote}&rdquo;
																	</p>
																)}
																{flag.evidence && !flag.quote && (
																	<p className="mt-1 text-[11px] text-[#667a6d]">{flag.evidence}</p>
																)}
															</div>
														))}
													</div>
												)}
											</td>

											{/* Images Column */}
											<td className="px-4 py-4 align-top sm:px-6">
												{hasQuarantinedImages ? (
													<div className="space-y-1.5">
														<span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
															<ShieldAlert className="size-3.5" />
															Đã ẩn ảnh vi phạm ({item.images.length} ảnh)
														</span>
														<div className="flex flex-wrap gap-2 pt-1">
															{item.images.map((_, idx) => (
																<button
																	type="button"
																	key={`${item.reviewId}-img-${idx}`}
																	onClick={() =>
																		setInspectingImage({
																			reviewId: item.reviewId,
																			imageIndex: idx,
																		})
																	}
																	className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] bg-white px-2.5 py-1 text-xs font-medium text-[#164027] hover:bg-[#f0f5ed]"
																>
																	<Eye className="size-3.5" />
																	<span>Xem ảnh #{idx + 1}</span>
																</button>
															))}
														</div>
													</div>
												) : hasLiveImages ? (
													<div className="space-y-1">
														<span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
															<ImageIcon className="size-3.5" />
															{item.images.length} ảnh đính kèm
														</span>
														<p className="text-[11px] text-[#728070]">
															(Ảnh đính kèm sẽ được kiểm duyệt nếu có báo cáo vi phạm)
														</p>
													</div>
												) : (
													<span className="text-xs text-[#8a9d7a]">Không có ảnh</span>
												)}
											</td>

											{/* Action Column */}
											<td className="px-4 py-4 text-right align-top sm:px-6">
												{status === "pending_review" && (
													<button
														type="button"
														onClick={() => setActiveDecisionItem(item)}
														className={buttonClass}
													>
														Xử lý
													</button>
												)}

												{status === "hidden" && (
													<button
														type="button"
														onClick={() => setActiveDecisionItem(item)}
														className={secondaryButtonClass}
													>
														Khôi phục
													</button>
												)}

												{status === "resolved" && (
													<span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
														Đã xử lý
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					{totalPages > 1 && (
						<footer className="flex items-center justify-between border-t border-[#dfe8df] bg-[#f9faf8] px-4 py-3 sm:px-6">
							<span className="text-xs text-[#53674d]">
								Hiển thị trang {page}/{totalPages} (tổng cộng {total} đánh giá)
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

			{/* Quarantined Image Modal */}
			{inspectingImage && (
				<QuarantinedImageModal
					reviewId={inspectingImage.reviewId}
					imageIndex={inspectingImage.imageIndex}
					onClose={() => setInspectingImage(null)}
				/>
			)}

			{/* Moderation Decision Dialog */}
			{activeDecisionItem && (
				<ModerationDecisionDialog
					item={activeDecisionItem}
					onClose={() => setActiveDecisionItem(null)}
					onSuccess={() => {
						setActiveDecisionItem(null);
						refreshData();
					}}
				/>
			)}
		</div>
	);
}
