import { Loader2 } from "lucide-react";

const actionClass = "rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40";

interface Props {
	disabled: boolean;
	loading: boolean;
	error?: string;
	canRetry: boolean;
	retry: () => void;
	cancelEdit: () => void;
}

export function RouteDrawingControls({
	disabled,
	loading,
	error,
	canRetry,
	retry,
	cancelEdit,
}: Props) {
	if (!loading && !error) return null;

	return (
		<div className="mt-3 space-y-2 text-sm">
			{loading && (
				<output className="flex items-center gap-2">
					<Loader2 aria-hidden className="size-4 animate-spin" /> Đang tìm đường đi bộ…
				</output>
			)}
			{error && (
				<div role="alert" className="space-y-2 text-red-700">
					<p>{error}</p>
					<div className="flex flex-wrap gap-2">
						{canRetry && (
							<button type="button" className={actionClass} disabled={disabled} onClick={retry}>
								Thử tìm đường lại
							</button>
						)}
						<button type="button" className={actionClass} disabled={disabled} onClick={cancelEdit}>
							Bỏ thay đổi
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
