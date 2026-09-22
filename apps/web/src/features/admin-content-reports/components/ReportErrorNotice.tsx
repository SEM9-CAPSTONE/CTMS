import type { ReportError } from "../types";

export function ReportErrorNotice({
	error,
	onRetry,
}: { error: ReportError; onRetry?: () => void }) {
	return (
		<div
			role="alert"
			className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
		>
			<p>{error.message}</p>
			{onRetry && (
				<button
					type="button"
					className="rounded-lg border border-red-300 px-3 py-2 font-bold"
					onClick={onRetry}
				>
					Thử lại
				</button>
			)}
		</div>
	);
}
