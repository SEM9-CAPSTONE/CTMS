import { Button, StatusBadge } from "../../../shared/components";
import { REQUEST_STATUS_LABELS, levelName } from "../constants";
import type { RequestDetail, RequestEvidence } from "../request-types";
import { LevelComparisonTable } from "./LevelComparisonTable";
import { LevelReviewHistory } from "./LevelReviewHistory";

export function LevelRequestDetailView({
	detail,
	pending,
	onDownload,
	onRemove,
}: {
	detail: RequestDetail;
	pending: boolean;
	onDownload: (file: RequestEvidence) => void;
	onRemove?: (fileId: string) => void;
}) {
	const { request, evidence, events } = detail;
	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-lg font-bold">{request.porterName ?? "người hỗ trợ"}</h3>
					<p className="mt-1 text-sm text-muted-foreground">{request.routeName}</p>
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
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
				<p>
					Cấp đề nghị:{" "}
					<strong>
						{levelName(request.currentLevel)} → {levelName(request.targetLevel)}
					</strong>
				</p>
				<p className="text-muted-foreground">
					Gửi ngày {new Date(request.createdAt).toLocaleDateString("vi-VN")}
				</p>
			</div>
			<section className="space-y-1 text-sm">
				<h4 className="font-semibold">Lý do đề nghị</h4>
				<p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
					{request.reason}
				</p>
			</section>
			{request.decisionReason && (
				<section className="border-l-2 border-[#164027] pl-3 text-sm">
					<h4 className="font-semibold">Phản hồi</h4>
					<p className="mt-1 whitespace-pre-wrap">{request.decisionReason}</p>
				</section>
			)}
			<section className="space-y-2">
				<h4 className="text-sm font-semibold">
					Minh chứng {evidence.length > 0 && `(${evidence.length})`}
				</h4>
				{!evidence.length && (
					<p className="text-sm text-muted-foreground">Chưa đính kèm minh chứng.</p>
				)}
				{evidence.map((file) => (
					<div
						key={file.id}
						className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 text-sm"
					>
						<div className="min-w-0">
							<p className="break-all font-medium">
								{file.fileName}
								{file.removedAt ? " (Đã gỡ)" : ""}
							</p>
							<p className="text-xs text-muted-foreground">{Math.ceil(file.size / 1024)} KB</p>
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
			{detail.decision ? (
				<LevelReviewHistory items={[detail.decision]} />
			) : (
				<LevelComparisonTable context={detail} />
			)}
			<details className="text-sm">
				<summary className="cursor-pointer py-2 font-semibold">
					Lịch sử xử lý ({events.length})
				</summary>
				<ol className="mt-2 space-y-3 border-l border-border pl-4">
					{events.map((event) => (
						<li key={event.id}>
							<p className="font-medium">
								{REQUEST_STATUS_LABELS[event.toStatus]}{" "}
								<span className="font-normal text-muted-foreground">
									·{" "}
									{new Date(event.createdAt).toLocaleString("vi-VN", {
										dateStyle: "short",
										timeStyle: "short",
									})}
								</span>
							</p>
							{event.reason && (
								<p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.reason}</p>
							)}
							<p className="mt-1 text-xs text-muted-foreground">{event.actorName ?? "Hệ thống"}</p>
						</li>
					))}
				</ol>
			</details>
		</div>
	);
}
