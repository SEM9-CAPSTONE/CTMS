import { AlertTriangle, CheckCircle2, Clock, Send, Upload } from "lucide-react";
import { useState } from "react";
import { Button, Modal, StatusBadge } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelName, levelReviewError } from "../constants";
import { useLevelRequests } from "../hooks/useLevelRequests";
import { useMyGlobalPorterLevel } from "../hooks/usePorterLevels";
import type { RequestFilters } from "../request-types";
import type { PorterLevel } from "../types";
import { LevelRequestDetailView } from "./LevelRequestDetailView";
import { LevelRequestList } from "./LevelRequestList";
import { LevelRequestPorterActions } from "./LevelRequestPorterActions";

const LEVEL_FALLBACK_LABELS: Record<PorterLevel, string> = {
	learning: "Học việc",
	proficient: "Thành thạo",
	expert: "Chuyên gia",
};

export function GlobalLevelRequestPanel() {
	const [filters, setFilters] = useState<RequestFilters>({ page: 1 });
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [reason, setReason] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [formError, setFormError] = useState<string | null>(null);

	const overviewQuery = useMyGlobalPorterLevel();
	const state = useLevelRequests(false, filters, selectedRequestId);
	const overview = overviewQuery.data;
	const detail = state.detail.data;

	const policies =
		overview?.levels.map((l) => l.policy).filter((p): p is NonNullable<typeof p> => Boolean(p)) ??
		[];

	const currentLevel = overview?.currentLevel ?? "learning";
	const nextLevel = overview?.nextLevel ?? null;
	const currentLabel = levelName(currentLevel, policies) || LEVEL_FALLBACK_LABELS[currentLevel];
	const nextLabel = nextLevel
		? levelName(nextLevel, policies) || LEVEL_FALLBACK_LABELS[nextLevel]
		: null;
	const nextEval = overview?.nextLevelEvaluation ?? null;
	const missingItems = nextEval?.comparison?.missingItems ?? [];

	// Pick an underlying qualification record transparently (Porter never picks a route)
	const backingQualification =
		state.qualifications.data?.find((q) => q.proficiency !== "expert" && !q.openRequestId) ?? null;

	const hasOpenRequest =
		state.list.data?.items.some(
			(item) => item.status === "pending" || item.status === "needs_info"
		) ?? false;

	const canCreate = Boolean(nextLevel && backingQualification && !hasOpenRequest);

	const pendingAction =
		state.cancel.isPending ||
		state.resubmit.isPending ||
		state.add.isPending ||
		state.remove.isPending ||
		state.download.isPending;
	const actionError =
		state.cancel.error ?? state.resubmit.error ?? state.add.error ?? state.remove.error;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);
		if (!nextLevel || !backingQualification) {
			setFormError("Hiện không thể gửi yêu cầu nâng cấp bậc.");
			return;
		}
		if (reason.trim().length < 10) {
			setFormError("Vui lòng nhập lý do đề nghị nâng cấp tối thiểu 10 ký tự.");
			return;
		}
		try {
			await state.create.mutateAsync({
				routeId: backingQualification.routeId,
				targetLevel: nextLevel,
				reason: reason.trim(),
				expectedQualificationVersion: backingQualification.version,
				files,
			});
			setCreating(false);
			setReason("");
			setFiles([]);
			void overviewQuery.refetch();
		} catch {
			// Error displayed via state.create.error
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2ed] pb-3.5">
				<div className="flex flex-wrap items-center gap-2.5">
					<h2 className="text-base font-bold text-[#10221b]">Yêu cầu nâng cấp bậc</h2>
					{nextLabel ? (
						<StatusBadge tone="neutral">
							{currentLabel} → {nextLabel}
						</StatusBadge>
					) : (
						<StatusBadge tone="success">Cấp cao nhất ({currentLabel})</StatusBadge>
					)}
				</div>

				<Button
					size="sm"
					disabled={!canCreate}
					onClick={() => {
						setFormError(null);
						state.create.reset();
						setCreating(true);
					}}
					className="gap-1.5"
				>
					<Send className="size-3.5" aria-hidden="true" />
					<span>Yêu cầu nâng cấp</span>
				</Button>
			</div>

			{!canCreate && currentLevel !== "expert" && (
				<p className="text-xs text-[#627769]">
					{hasOpenRequest
						? "Bạn đang có một yêu cầu nâng cấp chờ Quản trị viên xử lý."
						: "Hệ thống sẽ mở nút gửi yêu cầu khi hồ sơ của bạn đủ điều kiện đăng ký xét duyệt."}
				</p>
			)}

			{state.list.isPending && (
				<output className="text-xs text-[#627769]">Đang tải lịch sử yêu cầu…</output>
			)}
			{state.list.isError && (
				<p role="alert" className="text-xs text-rose-700">
					{levelReviewError(state.list.error)}
				</p>
			)}
			{state.list.data && state.list.data.items.length > 0 && (
				<LevelRequestList
					admin={false}
					data={state.list.data}
					page={filters.page}
					onPage={(page) => setFilters({ ...filters, page })}
					onSelect={(requestId) => {
						setSelectedRequestId(requestId);
						state.cancel.reset();
						state.resubmit.reset();
						state.add.reset();
						state.remove.reset();
						state.download.reset();
					}}
				/>
			)}
			{state.list.data && state.list.data.items.length === 0 && (
				<p className="rounded-xl bg-[#f8faf7] px-4 py-3 text-xs text-[#627769]">
					Chưa có yêu cầu nâng cấp bậc nào được gửi.
				</p>
			)}

			{/* Modal gửi yêu cầu nâng cấp tổng quát (không chọn tuyến) */}
			<Modal
				isOpen={creating}
				onClose={() => setCreating(false)}
				isCloseDisabled={state.create.isPending}
				title="Yêu cầu nâng cấp bậc tổng quát"
				size="lg"
			>
				<form onSubmit={handleSubmit} className="space-y-5">
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8faf7] p-4">
						<div>
							<p className="text-xs font-medium text-[#53674d]">Cấp bậc đề nghị</p>
							<p className="mt-0.5 text-base font-bold text-[#10221b]">
								{currentLabel} → {nextLabel}
							</p>
						</div>
						{nextEval && (
							<StatusBadge tone={nextEval.comparison?.allMet ? "success" : "warning"}>
								Đạt {nextEval.progressPercent}% tiêu chí
							</StatusBadge>
						)}
					</div>

					{/* Đối chiếu tiêu chí tổng quát */}
					{nextEval && (
						<div className="space-y-2.5">
							<p className="text-xs font-semibold text-[#10221b]">
								Đối chiếu tiêu chí cấp {nextLabel}
							</p>
							{nextEval.comparison?.allMet ? (
								<div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
									<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
									<span>
										Bạn đã đạt đủ tất cả tiêu chí số chuyến, quãng đường, đánh giá và chứng chỉ.
									</span>
								</div>
							) : (
								<ul className="space-y-2">
									{missingItems.map((item) => (
										<li
											key={`${item.code}-${item.label}`}
											className="flex items-start gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-xs text-amber-950"
										>
											{item.code === "pending_cert" ? (
												<Clock className="mt-0.5 size-3.5 shrink-0 text-sky-700" />
											) : (
												<AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
											)}
											<div>
												<p className="font-semibold">{item.label}</p>
												<p className="text-amber-900/90">{item.detail}</p>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					<label className="block text-xs font-semibold text-[#10221b]">
						Lý do đề nghị nâng cấp
						<textarea
							rows={3}
							maxLength={2000}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							disabled={state.create.isPending}
							placeholder="Tóm tắt kinh nghiệm dẫn đoàn, số chuyến hoàn thành và chứng chỉ bạn đã cập nhật..."
							className={`${LEVEL_INPUT_CLASS} mt-1.5 resize-y`}
						/>
					</label>

					<label className="block text-xs font-semibold text-[#10221b]">
						Tài liệu bổ sung (tùy chọn)
						<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-[#c7d6c7] bg-[#fafcfa] px-3.5 py-3 text-xs text-[#4a5e51]">
							<Upload className="size-4 text-[#164027]" aria-hidden="true" />
							<input
								type="file"
								multiple
								accept="image/*,application/pdf"
								disabled={state.create.isPending}
								onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
								className="w-full text-xs"
							/>
						</div>
					</label>

					{(formError || state.create.error) && (
						<p role="alert" className="text-xs font-medium text-rose-700">
							{formError || levelReviewError(state.create.error)}
						</p>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							disabled={state.create.isPending}
							onClick={() => setCreating(false)}
						>
							Hủy
						</Button>
						<Button type="submit" disabled={state.create.isPending}>
							{state.create.isPending ? "Đang gửi…" : "Gửi yêu cầu nâng cấp"}
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal xem chi tiết yêu cầu đã gửi */}
			<Modal
				isOpen={Boolean(selectedRequestId)}
				onClose={() => setSelectedRequestId(null)}
				isCloseDisabled={pendingAction}
				title="Chi tiết yêu cầu nâng cấp"
				size="xl"
			>
				<div className="space-y-5">
					{state.detail.isPending && <output>Đang tải yêu cầu…</output>}
					{state.detail.isError && <p role="alert">{levelReviewError(state.detail.error)}</p>}
					{detail && (
						<>
							<LevelRequestDetailView
								detail={detail}
								pending={pendingAction}
								onDownload={(file) => state.download.mutate(file)}
								onRemove={
									detail.request.status === "needs_info"
										? (fileId) => state.remove.mutate({ fileId, version: detail.request.version })
										: undefined
								}
							/>
							<LevelRequestPorterActions
								key={`${detail.request.id}-${detail.request.status}`}
								detail={detail}
								pending={pendingAction || state.detail.isFetching}
								error={actionError}
								onCancel={() => state.cancel.mutate(detail.request.version)}
								onResubmit={(nextReason) =>
									state.resubmit.mutateAsync({
										reason: nextReason,
										version: detail.request.version,
									})
								}
								onAdd={(newFiles) =>
									state.add.mutateAsync({ files: newFiles, version: detail.request.version })
								}
							/>
						</>
					)}
				</div>
			</Modal>
		</div>
	);
}
