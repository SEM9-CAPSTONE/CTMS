import {
	AlertTriangle,
	Bell,
	CheckCircle2,
	ChevronDown,
	Eye,
	RefreshCw,
	Search,
} from "lucide-react";
import { useState } from "react";
import { Button, Modal, Pagination, StatusBadge } from "../../../shared/components";
import { toast } from "../../../shared/components/Toast";
import { LEVEL_CODES, LEVEL_INPUT_CLASS, levelName, levelReviewError } from "../constants";
import { useAdminGlobalPorterLevels, useAdminPorterLevels } from "../hooks/usePorterLevels";
import type { GlobalPorterSummaryItem, PorterLevel } from "../types";

const LEVEL_FALLBACK_LABELS: Record<PorterLevel, string> = {
	learning: "Học việc",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
};

function levelTone(level: PorterLevel): "neutral" | "info" | "success" {
	if (level === "expert") return "success";
	if (level === "proficient") return "info";
	return "neutral";
}

export function AdminGlobalPorterLevelsPanel() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [selectedPorterId, setSelectedPorterId] = useState<string | null>(null);
	const [targetLevel, setTargetLevel] = useState<PorterLevel>("proficient");
	const [reason, setReason] = useState("");
	const [notifyNote, setNotifyNote] = useState("");

	const { policies } = useAdminPorterLevels(1, null, "learning");
	const state = useAdminGlobalPorterLevels(page, search, selectedPorterId);
	const policyList = policies.data ?? [];

	const items = state.list.data?.items ?? [];
	const total = state.list.data?.total ?? 0;
	const pageSize = 5;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const detail = state.detail.data;

	const openDetail = (item: GlobalPorterSummaryItem) => {
		setSelectedPorterId(item.porterId);
		setTargetLevel(item.nextLevel ?? item.currentLevel);
		setReason("");
		setNotifyNote("");
	};

	const handleApproveLevel = async () => {
		if (!selectedPorterId) return;
		if (!reason.trim()) {
			toast.error("Vui lòng nhập lý do xét duyệt hoặc điều chỉnh cấp bậc.");
			return;
		}
		try {
			await state.decideGlobal.mutateAsync({
				porterId: selectedPorterId,
				payload: {
					targetLevel,
					outcome: "approved",
					reason: reason.trim(),
				},
			});
			toast.success("Đã cập nhật cấp bậc tổng quát và gửi thông báo cho Người hỗ trợ.");
			setReason("");
		} catch (err) {
			toast.error(levelReviewError(err));
		}
	};

	const handleNotifyGaps = async () => {
		if (!selectedPorterId) return;
		try {
			const res = await state.notifyGaps.mutateAsync({
				porterId: selectedPorterId,
				customNote: notifyNote.trim() || undefined,
			});
			toast.success(
				res.missingCount > 0
					? `Đã gửi thông báo nhắc ${res.missingCount} tiêu chí còn thiếu cho Người hỗ trợ.`
					: "Đã gửi thông báo đủ điều kiện lên cấp cho Người hỗ trợ."
			);
			setNotifyNote("");
		} catch (err) {
			toast.error(levelReviewError(err));
		}
	};

	return (
		<section className="space-y-5 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs">
			{/* Header + Search */}
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf2ed] pb-4">
				<div>
					<h2 className="text-lg font-bold text-[#10221b]">Danh sách cấp bậc người hỗ trợ</h2>
					<p className="mt-0.5 text-xs text-[#627769]">
						Chấm cấp dựa trên tổng số chuyến hoàn thành, tổng km đã dẫn, điểm đánh giá và chứng chỉ
						hợp lệ
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div className="relative">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#667a6d]"
							aria-hidden="true"
						/>
						<input
							type="search"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
							placeholder="Tìm theo tên hoặc email..."
							aria-label="Tìm người hỗ trợ"
							className="h-9 w-60 rounded-xl border border-[#dfe8df] bg-white pl-9 pr-3 text-xs text-[#10221b] focus:border-[#164027] focus:outline-hidden"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={state.list.isFetching}
						onClick={() => void state.list.refetch()}
						className="gap-1.5 rounded-xl"
					>
						<RefreshCw
							className={`size-3.5 ${state.list.isFetching ? "animate-spin" : ""}`}
							aria-hidden="true"
						/>
						<span>Làm mới</span>
					</Button>
				</div>
			</div>

			{/* Table */}
			{state.list.isPending ? (
				<div className="space-y-2 py-6">
					{["r1", "r2", "r3"].map((k) => (
						<div key={k} className="h-12 animate-pulse rounded-xl bg-[#f4f7f2]" />
					))}
				</div>
			) : state.list.isError ? (
				<div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">
					{levelReviewError(state.list.error)}{" "}
					<Button variant="outline" size="sm" onClick={() => void state.list.refetch()}>
						Thử lại
					</Button>
				</div>
			) : items.length === 0 ? (
				<p className="py-10 text-center text-sm text-[#667a6d]">
					Không tìm thấy Người hỗ trợ nào phù hợp.
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-b border-[#e5ede5] bg-[#f8faf7] text-xs font-semibold text-[#53674d]">
							<tr>
								<th className="px-4 py-3">Người hỗ trợ</th>
								<th className="px-4 py-3">Cấp hiện tại</th>
								<th className="px-4 py-3">Chuyến & Quãng đường</th>
								<th className="px-4 py-3">Đánh giá</th>
								<th className="px-4 py-3">Chứng chỉ</th>
								<th className="px-4 py-3">Tiến độ lên cấp</th>
								<th className="px-4 py-3 text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#edf2ed]">
							{items.map((item) => {
								const currLabel =
									levelName(item.currentLevel, policyList) ||
									LEVEL_FALLBACK_LABELS[item.currentLevel];
								const nextLabel = item.nextLevel
									? levelName(item.nextLevel, policyList) || LEVEL_FALLBACK_LABELS[item.nextLevel]
									: null;
								return (
									<tr key={item.porterId} className="transition-colors hover:bg-[#f9fbf9]">
										<td className="px-4 py-3.5">
											<p className="font-semibold text-[#10221b]">{item.porterName}</p>
											<p className="text-xs text-[#667a6d]">{item.porterEmail}</p>
										</td>
										<td className="px-4 py-3.5">
											<StatusBadge tone={levelTone(item.currentLevel)}>{currLabel}</StatusBadge>
										</td>
										<td className="px-4 py-3.5 text-xs">
											<p className="font-semibold text-[#10221b]">
												{item.completedTrips} chuyến · {item.totalKmLed} km
											</p>
											<p className="text-[#667a6d]">{item.experienceYears} năm kinh nghiệm</p>
										</td>
										<td className="px-4 py-3.5 text-xs font-semibold text-[#10221b]">
											{item.averageRating.toFixed(1)}★
											<span className="ml-1 font-normal text-[#667a6d]">({item.reviewCount})</span>
										</td>
										<td className="px-4 py-3.5 text-xs font-semibold text-[#164027]">
											{item.verifiedCertificatesCount} hợp lệ
										</td>
										<td className="px-4 py-3.5 text-xs">
											{!nextLabel ? (
												<StatusBadge tone="success">Đạt cấp cao nhất</StatusBadge>
											) : item.nextLevelAllMet ? (
												<StatusBadge tone="success">Đủ điều kiện lên {nextLabel}</StatusBadge>
											) : (
												<div className="space-y-1">
													<div className="flex items-center justify-between gap-2 text-[11px]">
														<span className="font-medium text-[#53674d]">Lên {nextLabel}</span>
														<span className="font-bold text-[#164027]">
															{item.nextLevelProgressPercent}%
														</span>
													</div>
													<div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#e3ece3]">
														<div
															className="h-full rounded-full bg-[#164027]"
															style={{ width: `${item.nextLevelProgressPercent}%` }}
														/>
													</div>
													{item.missingItems.length > 0 && (
														<p className="text-[11px] text-amber-800">
															Thiếu {item.missingItems.length} tiêu chí
														</p>
													)}
												</div>
											)}
										</td>
										<td className="px-4 py-3.5 text-right">
											<Button
												variant="outline"
												size="sm"
												onClick={() => openDetail(item)}
												className="gap-1.5 rounded-xl"
											>
												<Eye className="size-3.5" aria-hidden="true" />
												<span>Chi tiết</span>
											</Button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{total > 0 && (
				<Pagination
					currentPage={page}
					totalPages={totalPages}
					onPageChange={setPage}
					totalItems={total}
					itemsPerPage={pageSize}
				/>
			)}

			{/* Detail & Action Modal */}
			<Modal
				isOpen={Boolean(selectedPorterId)}
				onClose={() => setSelectedPorterId(null)}
				isCloseDisabled={state.decideGlobal.isPending || state.notifyGaps.isPending}
				title={detail ? `Hồ sơ phân cấp: ${detail.porterName ?? "Người hỗ trợ"}` : "Hồ sơ phân cấp"}
				size="xl"
			>
				{state.detail.isPending ? (
					<output className="block py-8 text-center text-sm text-[#667a6d]">
						Đang tải hồ sơ năng lực…
					</output>
				) : detail ? (
					<div className="space-y-5">
						{/* 4 chỉ số thật */}
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div className="rounded-xl bg-[#f8faf7] p-3.5">
								<p className="text-xs text-[#53674d]">Cấp hiện tại</p>
								<p className="mt-1 text-base font-bold text-[#164027]">
									{levelName(detail.currentLevel, policyList) ||
										LEVEL_FALLBACK_LABELS[detail.currentLevel]}
								</p>
							</div>
							<div className="rounded-xl bg-[#f8faf7] p-3.5">
								<p className="text-xs text-[#53674d]">Chuyến & Km đã dẫn</p>
								<p className="mt-1 text-base font-bold text-[#10221b]">
									{detail.metrics.completedTrips} chuyến · {detail.metrics.totalKmLed} km
								</p>
							</div>
							<div className="rounded-xl bg-[#f8faf7] p-3.5">
								<p className="text-xs text-[#53674d]">Đánh giá</p>
								<p className="mt-1 text-base font-bold text-[#10221b]">
									{detail.metrics.averageRating.toFixed(1)}★ ({detail.metrics.reviewCount})
								</p>
							</div>
							<div className="rounded-xl bg-[#f8faf7] p-3.5">
								<p className="text-xs text-[#53674d]">Chứng chỉ hợp lệ</p>
								<p className="mt-1 text-base font-bold text-[#10221b]">
									{detail.metrics.verifiedCertificatesCount} chứng chỉ
								</p>
							</div>
						</div>

						{/* Đối chiếu tiêu chí cấp tiếp theo */}
						{detail.nextLevelEvaluation && detail.nextLevel && (
							<div className="space-y-2.5 rounded-xl bg-[#f8faf7] p-4">
								<div className="flex items-center justify-between text-xs font-semibold">
									<span className="text-[#10221b]">
										Đối chiếu điều kiện lên cấp{" "}
										{levelName(detail.nextLevel, policyList) ||
											LEVEL_FALLBACK_LABELS[detail.nextLevel]}
									</span>
									<span className="text-[#164027]">
										{detail.nextLevelEvaluation.progressPercent}%
									</span>
								</div>

								{detail.nextLevelEvaluation.comparison?.allMet ? (
									<p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
										<CheckCircle2 className="size-4" />
										<span>Đã đạt đủ tất cả tiêu chí lên cấp tiếp theo.</span>
									</p>
								) : (
									(() => {
										const gaps = detail.nextLevelEvaluation.comparison?.missingItems ?? [];
										const nonSkillGaps = gaps.filter((g) => g.code !== "missing_skill");
										const skillGaps = gaps.filter((g) => g.code === "missing_skill");
										return (
											<div className="space-y-2">
												{nonSkillGaps.length > 0 && (
													<ul className="space-y-1.5">
														{nonSkillGaps.map((gap) => (
															<li
																key={`${gap.code}-${gap.label}`}
																className="flex items-center gap-2 text-xs font-medium text-amber-950"
															>
																<AlertTriangle className="size-3.5 shrink-0 text-amber-700" />
																<span>{gap.label}</span>
															</li>
														))}
													</ul>
												)}
												{skillGaps.length > 0 && (
													<details className="group text-xs text-amber-950">
														<summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium transition-colors hover:text-[#164027]">
															<span className="flex items-center gap-2">
																<AlertTriangle className="size-3.5 shrink-0 text-amber-700" />
																<span>Chưa khai báo {skillGaps.length} kỹ năng</span>
															</span>
															<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#53674d]">
																<span>Xem chi tiết</span>
																<ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
															</span>
														</summary>
														<div className="mt-2 flex flex-wrap gap-1.5 pl-5.5">
															{skillGaps.map((gap) => (
																<span
																	key={gap.label}
																	className="rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-950"
																>
																	{gap.label.replace(/^Chưa khai báo kỹ năng:\s*/i, "")}
																</span>
															))}
														</div>
													</details>
												)}
											</div>
										);
									})()
								)}
							</div>
						)}

						{/* Khối 1: Gửi thông báo nhắc tiêu chí còn thiếu */}
						<div className="space-y-2.5 border-t border-[#edf2ed] pt-4">
							<h3 className="text-xs font-bold uppercase tracking-wide text-[#53674d]">
								Thông báo tiêu chí còn thiếu cho Người hỗ trợ
							</h3>
							<div className="flex flex-col gap-2 sm:flex-row">
								<input
									type="text"
									value={notifyNote}
									onChange={(e) => setNotifyNote(e.target.value)}
									placeholder="Ghi chú thêm cho Người hỗ trợ (tùy chọn)..."
									className={`${LEVEL_INPUT_CLASS} flex-1`}
								/>
								<Button
									variant="outline"
									disabled={state.notifyGaps.isPending}
									onClick={() => void handleNotifyGaps()}
									className="shrink-0 gap-1.5"
								>
									<Bell className="size-3.5" aria-hidden="true" />
									<span>
										{state.notifyGaps.isPending ? "Đang gửi..." : "Gửi thông báo nhắc bổ sung"}
									</span>
								</Button>
							</div>
						</div>

						{/* Khối 2: Xét duyệt / Điều chỉnh cấp bậc tổng quát */}
						<div className="space-y-3 border-t border-[#edf2ed] pt-4">
							<h3 className="text-xs font-bold uppercase tracking-wide text-[#53674d]">
								Xét duyệt / Điều chỉnh cấp bậc tổng quát
							</h3>
							<div className="grid gap-3 sm:grid-cols-3">
								<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
									Cấp bậc áp dụng
									<select
										value={targetLevel}
										onChange={(e) => setTargetLevel(e.target.value as PorterLevel)}
										className={LEVEL_INPUT_CLASS}
									>
										{LEVEL_CODES.map((code) => (
											<option key={code} value={code}>
												{levelName(code, policyList) || LEVEL_FALLBACK_LABELS[code]}
											</option>
										))}
									</select>
								</label>
								<label className="block space-y-1 text-xs font-semibold text-[#10221b] sm:col-span-2">
									Lý do xét duyệt / điều chỉnh
									<input
										type="text"
										value={reason}
										onChange={(e) => setReason(e.target.value)}
										placeholder="Ví dụ: Đã hoàn thành đủ số chuyến, km và chứng chỉ WFA hợp lệ..."
										className={LEVEL_INPUT_CLASS}
									/>
								</label>
							</div>
							<div className="flex justify-end gap-2 pt-1">
								<Button variant="outline" onClick={() => setSelectedPorterId(null)}>
									Đóng
								</Button>
								<Button
									variant="primary"
									disabled={state.decideGlobal.isPending}
									onClick={() => void handleApproveLevel()}
								>
									{state.decideGlobal.isPending ? "Đang lưu..." : "Xác nhận cập nhật cấp bậc"}
								</Button>
							</div>
						</div>
					</div>
				) : null}
			</Modal>
		</section>
	);
}
