import { Button } from "../../../shared/components";
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
			<div className="grid gap-2 text-sm sm:grid-cols-2">
				<p>Porter: {request.porterName ?? request.porterId}</p>
				<p>Tuyến: {request.routeName}</p>
				<p>Trạng thái: {REQUEST_STATUS_LABELS[request.status]}</p>
				<p>
					Cấp xin nâng: {levelName(request.currentLevel)} → {levelName(request.targetLevel)}
				</p>
				<p>Lúc gửi: {request.currentVerified ? "Đã xác minh" : "Tự khai, chưa xác minh"}</p>
				<p>
					Hiện tại: {levelName(detail.qualification.proficiency)} ·{" "}
					{detail.qualification.verifiedBy ? "Đã xác minh" : "Chưa xác minh"}
				</p>
			</div>
			<p className="whitespace-pre-wrap text-sm">Lý do của Porter: {request.reason}</p>
			{request.decisionReason && (
				<p className="whitespace-pre-wrap rounded-xl bg-[#f4f7f2] p-3 text-sm">
					Phản hồi Admin: {request.decisionReason}
				</p>
			)}
			{detail.decision ? (
				<LevelReviewHistory items={[detail.decision]} />
			) : (
				<LevelComparisonTable context={detail} />
			)}
			<section className="space-y-2">
				<h3 className="font-bold">Minh chứng</h3>
				{!evidence.length && <p className="text-sm">Chưa có tệp minh chứng.</p>}
				{evidence.map((file) => (
					<div
						key={file.id}
						className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dfe8df] p-3 text-sm"
					>
						<div className="min-w-0">
							<p className="break-all">
								{file.fileName}
								{file.removedAt ? " (Đã bỏ khỏi yêu cầu, vẫn lưu bản gốc)" : ""}
							</p>
							<p>{Math.ceil(file.size / 1024)} KB</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" disabled={pending} onClick={() => onDownload(file)}>
								Tải minh chứng
							</Button>
							{onRemove && !file.removedAt && (
								<Button variant="outline" disabled={pending} onClick={() => onRemove(file.id)}>
									Bỏ minh chứng
								</Button>
							)}
						</div>
					</div>
				))}
			</section>
			<section className="space-y-2">
				<h3 className="font-bold">Tiến độ xử lý</h3>
				<ol className="space-y-3 border-l border-[#dfe8df] pl-4">
					{events.map((event) => (
						<li key={event.id} className="text-sm">
							<p className="font-semibold">
								{REQUEST_STATUS_LABELS[event.toStatus]} ·{" "}
								{new Date(event.createdAt).toLocaleString("vi-VN")}
							</p>
							{event.reason && <p className="whitespace-pre-wrap">{event.reason}</p>}
							<p className="text-xs text-[#627769]">
								Người thao tác: {event.actorName ?? "Tài khoản hệ thống"}
							</p>
						</li>
					))}
				</ol>
			</section>
		</div>
	);
}
