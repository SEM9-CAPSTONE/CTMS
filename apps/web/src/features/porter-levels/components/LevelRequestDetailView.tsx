import { Button, StatusBadge } from "../../../shared/components";
import { REQUEST_STATUS_LABELS, levelName } from "../constants";
import type { RequestDetail, RequestEvidence } from "../request-types";
import type { GlobalPorterLevelOverview } from "../types";
import { LevelComparisonTable } from "./LevelComparisonTable";
import { LevelReviewHistory } from "./LevelReviewHistory";

export function LevelRequestDetailView({
	detail,
	globalOverview,
	pending,
	onDownload,
	onRemove,
}: {
	detail: RequestDetail;
	globalOverview?: GlobalPorterLevelOverview | null;
	pending: boolean;
	onDownload: (file: RequestEvidence) => void;
	onRemove?: (fileId: string) => void;
}) {
	const { request, evidence, events } = detail;
	return (
		<div className="space-y-5">
			{/* Header tóm tắt yêu cầu (chuẩn Impeccable: nền dịu, không viền gắt) */}
			<div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-[#f8faf7] p-4">
				<div className="space-y-1">
					<h3 className="text-base font-bold text-[#10221b]">
						{request.porterName ?? "Người hỗ trợ"}
					</h3>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#53674d]">
						<span>
							Cấp đề nghị:{" "}
							<strong className="font-semibold text-[#10221b]">
								{levelName(request.currentLevel)} → {levelName(request.targetLevel)}
							</strong>
						</span>
						<span>Gửi ngày {new Date(request.createdAt).toLocaleDateString("vi-VN")}</span>
					</div>
				</div>
				<StatusBadge
					tone={
						request.status === "approved"
							? "success"
							: request.status === "rejected"
								? "danger"
								: request.status === "cancelled"
									? "neutral"
									: "warning"
					}
				>
					{REQUEST_STATUS_LABELS[request.status]}
				</StatusBadge>
			</div>

			{/* Lý do đề nghị */}
			<section className="space-y-1.5">
				<h4 className="text-xs font-semibold uppercase tracking-wide text-[#53674d]">
					Lý do đề nghị
				</h4>
				<p className="whitespace-pre-wrap text-sm leading-relaxed text-[#10221b]">
					{request.reason}
				</p>
			</section>

			{request.decisionReason && (
				<section className="rounded-xl border-l-3 border-[#164027] bg-[#f8faf7] px-4 py-3 text-sm">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-[#164027]">Phản hồi</h4>
					<p className="mt-1 whitespace-pre-wrap leading-relaxed text-[#10221b]">
						{request.decisionReason}
					</p>
				</section>
			)}

			{/* Minh chứng đính kèm */}
			<section className="space-y-2 border-t border-[#edf2ed] pt-4">
				<h4 className="text-xs font-semibold uppercase tracking-wide text-[#53674d]">
					Minh chứng {evidence.length > 0 && `(${evidence.length})`}
				</h4>
				{!evidence.length && <p className="text-xs text-[#667a6d]">Chưa đính kèm minh chứng.</p>}
				{evidence.map((file) => (
					<div
						key={file.id}
						className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8faf7] px-3.5 py-2.5 text-sm"
					>
						<div className="min-w-0">
							<p className="break-all font-medium text-[#10221b]">
								{file.fileName}
								{file.removedAt ? " (Đã gỡ)" : ""}
							</p>
							<p className="text-xs text-[#667a6d]">{Math.ceil(file.size / 1024)} KB</p>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={pending}
								onClick={() => onDownload(file)}
							>
								Tải minh chứng
							</Button>
							{onRemove && !file.removedAt && (
								<Button
									variant="ghost"
									size="sm"
									disabled={pending}
									onClick={() => onRemove(file.id)}
								>
									Gỡ
								</Button>
							)}
						</div>
					</div>
				))}
			</section>

			{/* Đối chiếu tiêu chí hoặc Quyết định */}
			<div className="border-t border-[#edf2ed] pt-4">
				{detail.decision ? (
					<LevelReviewHistory items={[detail.decision]} />
				) : (
					<LevelComparisonTable context={detail} globalOverview={globalOverview} />
				)}
			</div>

			{/* Lịch sử xử lý */}
			<details className="rounded-xl bg-[#f8faf7] px-4 py-2.5 text-sm">
				<summary className="cursor-pointer py-1 text-xs font-semibold text-[#10221b]">
					Lịch sử xử lý ({events.length})
				</summary>
				<ol className="mt-2.5 space-y-3 border-l-2 border-[#d5e3d8] pl-4 pb-1">
					{events.map((event) => (
						<li key={event.id}>
							<p className="text-xs font-semibold text-[#10221b]">
								{REQUEST_STATUS_LABELS[event.toStatus]}{" "}
								<span className="font-normal text-[#667a6d]">
									·{" "}
									{new Date(event.createdAt).toLocaleString("vi-VN", {
										dateStyle: "short",
										timeStyle: "short",
									})}
								</span>
							</p>
							{event.reason && (
								<p className="mt-1 whitespace-pre-wrap text-xs text-[#4a5e51]">{event.reason}</p>
							)}
							<p className="mt-0.5 text-[11px] text-[#667a6d]">{event.actorName ?? "Hệ thống"}</p>
						</li>
					))}
				</ol>
			</details>
		</div>
	);
}
