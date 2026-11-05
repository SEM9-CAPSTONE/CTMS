import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../core/api/queryKeys";
import { analysisService } from "./service";
import { friendlyError } from "./useReviewAnalysis";
export function ReviewSource({
	actor,
	tripId,
	reviewId,
	revision,
}: { actor: string; tripId: string; reviewId: string; revision: number }) {
	const [open, setOpen] = useState(false);
	const source = useQuery({
		queryKey: queryKeys.reviewAnalysis.source(actor, tripId, reviewId, revision),
		queryFn: ({ signal }) => analysisService.source(tripId, reviewId, revision, signal),
		enabled: open,
		retry: false,
		staleTime: 0,
		gcTime: 0,
	});
	return (
		<div className="mt-4 border-t border-[#e5ece5] pt-3">
			<button
				type="button"
				className="text-sm font-semibold text-[#164027] underline underline-offset-4"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				{open ? "Đóng đánh giá gốc" : "Xem đánh giá gốc"} · phiên bản {revision}
			</button>
			{open && (
				<div className="mt-3 rounded-xl bg-[#f5f7f3] p-4 text-sm" aria-live="polite">
					{source.isPending ? (
						"Đang tải đánh giá gốc…"
					) : source.isError ? (
						<p role="alert">{friendlyError(source.error)}</p>
					) : (
						source.data && (
							<>
								<p className="font-semibold">
									Đánh giá của người tham gia · {source.data.rating}/5 sao
								</p>
								<p className="mt-2 whitespace-pre-wrap break-words">
									{source.data.comment || "Không có nhận xét."}
								</p>
								<p className="mt-2 text-xs text-[#66756d]">
									Phiên bản nguồn {source.data.revision}
									{source.data.currentRevision !== source.data.revision
										? ` · Hiện đã có phiên bản ${source.data.currentRevision}`
										: " · Phiên bản hiện tại"}
								</p>
							</>
						)
					)}
				</div>
			)}
		</div>
	);
}
