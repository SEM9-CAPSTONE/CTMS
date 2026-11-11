import { AlertCircle, Loader2, Send } from "lucide-react";
import { useSubmitRouteForApproval } from "../hooks/useSubmitRouteForApproval";
import type { CreatedTrekkingRoute } from "../types";
interface RouteSubmissionPanelProps {
	route: CreatedTrekkingRoute;
	onReload: () => Promise<unknown>;
	onSubmitted: (route: CreatedTrekkingRoute) => void;
}
export function RouteSubmissionPanel({ route, onReload, onSubmitted }: RouteSubmissionPanelProps) {
	const submission = useSubmitRouteForApproval(onReload);
	if (route.status !== "draft") return null;
	return (
		<section
			aria-label="Gửi duyệt tuyến đường"
			className="mt-5 rounded-xl border border-[#cbd9ce] bg-[#f8fbf7] p-4"
		>
			<h3 className="font-extrabold text-[#10221b]">Gửi duyệt tuyến đường</h3>
			<p className="mt-1 text-sm text-[#667a6d]">
				Gửi đường tuyến đã lưu để quản trị viên xem xét.
			</p>
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
					disabled={submission.isSubmitting}
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
