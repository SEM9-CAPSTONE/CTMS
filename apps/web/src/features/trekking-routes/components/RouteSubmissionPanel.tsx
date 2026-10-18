import { AlertCircle, Loader2, Send } from "lucide-react";
import { useSubmitRouteForApproval } from "../hooks/useSubmitRouteForApproval";
import type { CreatedTrekkingRoute } from "../types";

interface RouteSubmissionPanelProps {
	route: CreatedTrekkingRoute;
	isLoadingCheckpoints: boolean;
	checkpointError: string;
	onReload: () => Promise<unknown>;
	onSubmitted: (route: CreatedTrekkingRoute) => void;
}

export function RouteSubmissionPanel({
	route,
	isLoadingCheckpoints,
	checkpointError,
	onReload,
	onSubmitted,
}: RouteSubmissionPanelProps) {
	const submission = useSubmitRouteForApproval(onReload);

	if (route.status !== "draft") return null;

	const readinessUnavailable = isLoadingCheckpoints || Boolean(checkpointError);
	const submitDisabled = readinessUnavailable || submission.isSubmitting;

	return (
		<section aria-label="Gửi duyệt tuyến" className="mt-5 flex flex-col items-end gap-3">
			{submission.error && (
				<div
					role="alert"
					className="flex w-full gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<AlertCircle className="size-5 shrink-0" /> {submission.error.message}
				</div>
			)}
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
		</section>
	);
}
