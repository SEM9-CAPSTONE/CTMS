import { ArrowRight, Sparkles } from "lucide-react";
import { Button, Card, StatusBadge } from "../../../shared/components";
import {
	TRIP_TYPE_LABELS,
	formatMonthVi,
	formatShortDateVi,
	formatSuggestedPrice,
} from "../constants";
import type { ActiveSuggestionJobConflict, HostSuggestionJobResponse } from "../types";

export interface HostSuggestionsSectionProps {
	job: HostSuggestionJobResponse | null;
	isLoading: boolean;
	isPolling: boolean;
	isCreating: boolean;
	waitSeconds: number;
	activeConflict: ActiveSuggestionJobConflict | null;
	quickCreateBusyId: string | null;
	onCreateJob: () => void;
	onInspectConflictJob: (jobId: string) => void;
	onQuickCreate: (suggestionId: string) => void;
}

export function HostSuggestionsSection({
	job,
	isLoading,
	isPolling,
	isCreating,
	waitSeconds,
	activeConflict,
	quickCreateBusyId,
	onCreateJob,
	onInspectConflictJob,
	onQuickCreate,
}: HostSuggestionsSectionProps) {
	const buttonDisabled = isCreating || isPolling || waitSeconds > 0;

	return (
		<Card className="space-y-4 p-5">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8efe8] pb-3">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-base font-semibold text-[#10221b]">
							Phương án tham khảo — Gợi ý tổ chức chuyến đi
						</h2>
						<StatusBadge tone="info">Tham khảo</StatusBadge>
						{job?.stale && <StatusBadge tone="warning">Dữ liệu đã thay đổi</StatusBadge>}
					</div>
					<p className="mt-1 text-xs text-[#526357]">
						Giá và sức chứa là trung vị từ các chuyến trước của bạn.
					</p>
				</div>

				<Button
					variant="primary"
					size="sm"
					onClick={onCreateJob}
					disabled={buttonDisabled}
					aria-busy={isCreating || isPolling}
				>
					<Sparkles className="size-4" aria-hidden="true" />
					<span>
						{waitSeconds > 0
							? `Chờ ${waitSeconds} giây`
							: isCreating || isPolling
								? "Đang tổng hợp gợi ý..."
								: "Tạo gợi ý chuyến đi"}
					</span>
				</Button>
			</div>

			{activeConflict && (
				<output className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
					<div className="space-y-0.5">
						<p className="font-semibold">
							Đang có một yêu cầu tạo gợi ý khác đang chạy với bộ lọc khác
						</p>
						<p>
							Kỳ: {formatShortDateVi(activeConflict.periodFrom)} –{" "}
							{formatShortDateVi(activeConflict.periodTo)} · Khu vực:{" "}
							{activeConflict.areaCode ?? "Tất cả khu vực"}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onInspectConflictJob(activeConflict.id)}
					>
						Xem yêu cầu đang chạy
					</Button>
				</output>
			)}

			{job?.stale && job.status === "succeeded" && (
				<p className="rounded-lg bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
					Dữ liệu chuyến đi hoặc doanh thu đã thay đổi kể từ lần tạo gợi ý này. Bạn vẫn có thể tham
					khảo danh sách bên dưới hoặc bấm “Tạo gợi ý chuyến đi” để cập nhật.
				</p>
			)}

			{isLoading ? (
				<p className="py-6 text-center text-sm text-[#647468]">Đang kiểm tra gợi ý gần nhất...</p>
			) : isPolling ? (
				<div
					aria-live="polite"
					className="rounded-xl bg-[#f4f8f4] px-4 py-6 text-center text-sm text-[#2c4234]"
				>
					Hệ thống đang tổng hợp gợi ý từ lịch sử chuyến đi của bạn. Kết quả sẽ tự động hiển thị khi
					hoàn tất.
				</div>
			) : job?.status === "failed" ? (
				<div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-4 text-sm text-red-900">
					Hiện chưa thể tổng hợp gợi ý chuyến đi do dịch vụ phân tích tạm thời gián đoạn. Lượt tạo
					trong ngày của bạn đã được hoàn lại, vui lòng thử lại sau.
				</div>
			) : !job || job.suggestions.length === 0 ? (
				<p className="py-6 text-center text-sm text-[#647468]">
					Chưa có gợi ý nào. Bấm “Tạo gợi ý chuyến đi” để hệ thống đề xuất phương án phù hợp với bộ
					lọc hiện tại.
				</p>
			) : (
				<div className="divide-y divide-[#e8efe8]">
					{job.suggestions.map((item) => {
						const busy = quickCreateBusyId === item.id;
						return (
							<div
								key={item.id}
								className="flex flex-col justify-between gap-4 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-start"
							>
								<div className="space-y-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="text-sm font-semibold text-[#10221b]">
											{item.routeName || "Tuyến trekking của bạn"}
										</h3>
										<StatusBadge tone="neutral">{formatMonthVi(item.monthHint)}</StatusBadge>
										<StatusBadge tone="neutral">{TRIP_TYPE_LABELS[item.tripType]}</StatusBadge>
									</div>

									<p className="text-xs text-[#435649]">
										<span>Khu vực: {item.areaName || "Chưa gắn khu vực"}</span>
										{" · "}
										<span>Giá tham khảo: {formatSuggestedPrice(item.suggestedPricePerPerson)}</span>
										{" · "}
										<span>
											Sức chứa tối thiểu:{" "}
											{item.suggestedCapacityMin !== null
												? `từ ${item.suggestedCapacityMin} khách`
												: "Chưa đủ lịch sử"}
										</span>
									</p>

									{item.rationaleLabels.length > 0 && (
										<ul className="list-disc space-y-0.5 pl-4 text-xs text-[#526357]">
											{item.rationaleLabels.map((label) => (
												<li key={label}>{label}</li>
											))}
										</ul>
									)}
								</div>

								<Button
									variant="outline"
									size="sm"
									onClick={() => onQuickCreate(item.id)}
									disabled={busy}
									className="shrink-0"
								>
									<span>{busy ? "Đang kiểm tra..." : "Tạo chuyến nhanh"}</span>
									<ArrowRight className="size-4" aria-hidden="true" />
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
