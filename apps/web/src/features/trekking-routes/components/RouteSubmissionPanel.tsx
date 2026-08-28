import { AlertCircle, Loader2, Send } from "lucide-react";
import { useMemo } from "react";
import { useSubmitRouteForApproval } from "../hooks/useSubmitRouteForApproval";
import type { CreatedTrekkingRoute, RouteCheckpoint } from "../types";
import {
	type RouteSubmissionReadinessIssue,
	getRouteSubmissionReadiness,
} from "../utils/route-submission-readiness";

interface RouteSubmissionPanelProps {
	route: CreatedTrekkingRoute;
	checkpoints: RouteCheckpoint[];
	isLoadingCheckpoints: boolean;
	checkpointError: string;
	onReload: () => Promise<unknown>;
	onSubmitted: (route: CreatedTrekkingRoute) => void;
}

const issueMessages: Record<RouteSubmissionReadinessIssue, string> = {
	missing_start: "Thiếu checkpoint Bắt đầu.",
	missing_finish: "Thiếu checkpoint Kết thúc.",
	duplicate_start: "Tuyến chỉ được có một checkpoint Bắt đầu.",
	duplicate_finish: "Tuyến chỉ được có một checkpoint Kết thúc.",
	invalid_order: "Checkpoint Bắt đầu phải đứng trước checkpoint Kết thúc.",
};

export function RouteSubmissionPanel({
	route,
	checkpoints,
	isLoadingCheckpoints,
	checkpointError,
	onReload,
	onSubmitted,
}: RouteSubmissionPanelProps) {
	const submission = useSubmitRouteForApproval(onReload);
	const readiness = useMemo(() => getRouteSubmissionReadiness(checkpoints), [checkpoints]);
	const startCount = checkpoints.filter((checkpoint) => checkpoint.type === "start").length;
	const finishCount = checkpoints.filter((checkpoint) => checkpoint.type === "finish").length;

	if (route.status !== "draft") return null;

	const readinessUnavailable = isLoadingCheckpoints || Boolean(checkpointError);
	const submitDisabled = readinessUnavailable || !readiness.canSubmit || submission.isSubmitting;

	return (
		<section
			aria-label="Mức độ sẵn sàng gửi duyệt"
			className="mt-5 rounded-xl border border-[#cbd9ce] bg-[#f8fbf7] p-4"
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h3 className="font-extrabold text-[#10221b]">Chuẩn bị gửi duyệt</h3>
					<p className="mt-1 text-sm text-[#667a6d]">
						Máy chủ sẽ kiểm tra lại toàn bộ dữ liệu tuyến và checkpoint khi gửi.
					</p>
				</div>
				<div className="flex gap-2 text-xs font-bold">
					<span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#cbd9ce]">
						Bắt đầu: {startCount}/1
					</span>
					<span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#cbd9ce]">
						Kết thúc: {finishCount}/1
					</span>
				</div>
			</div>

			{isLoadingCheckpoints && (
				<p
					data-testid="submission-readiness-loading"
					className="mt-4 flex items-center gap-2 text-sm"
				>
					<Loader2 className="size-4 animate-spin" /> Đang kiểm tra checkpoint...
				</p>
			)}
			{checkpointError && !isLoadingCheckpoints && (
				<p className="mt-4 flex gap-2 text-sm font-semibold text-amber-800">
					<AlertCircle className="size-5 shrink-0" />
					Không thể xác định mức độ sẵn sàng. Hãy tải lại danh sách checkpoint.
				</p>
			)}
			{!readinessUnavailable && !readiness.canSubmit && (
				<div className="mt-4 text-sm text-amber-800">
					<p className="font-extrabold">Tuyến chưa đủ điều kiện gửi duyệt.</p>
					<ul className="mt-2 list-disc space-y-1 pl-5">
						{readiness.issues.map((issue) => (
							<li key={issue}>{issueMessages[issue]}</li>
						))}
					</ul>
				</div>
			)}
			{submission.error && (
				<div
					role="alert"
					className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<AlertCircle className="size-5 shrink-0" /> {submission.error.message}
				</div>
			)}

			<div className="mt-4 flex justify-end">
				<button
					type="button"
					disabled={submitDisabled}
					onClick={async () => {
						submission.clearError();
						const updated = await submission.submit(route.id);
						if (updated?.status === "pending_approval") onSubmitted(updated);
					}}
					className="flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submission.isSubmitting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					{submission.isSubmitting ? "Đang gửi duyệt..." : "Gửi duyệt"}
				</button>
			</div>
		</section>
	);
}
