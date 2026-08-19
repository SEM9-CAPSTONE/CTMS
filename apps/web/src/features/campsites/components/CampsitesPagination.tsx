import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CampsiteSearchPagination } from "../types";

export interface CampsitesPaginationProps {
	pagination: CampsiteSearchPagination;
	/** Locked while loading (BR-241) -- paging during an in-flight request would race a second concurrent GET /campsites. */
	disabled: boolean;
	onPageChange: (page: number) => void;
}

export function CampsitesPagination({
	pagination,
	disabled,
	onPageChange,
}: CampsitesPaginationProps) {
	return (
		<div className="flex flex-col gap-3 border-t border-[#e0ebe0] bg-white px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between">
			<p>
				Tổng cộng <strong className="text-[#10221b]">{pagination.total}</strong> campsite
			</p>
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label="Trang trước"
					disabled={disabled || pagination.page <= 1}
					onClick={() => onPageChange(pagination.page - 1)}
					className="rounded-lg border border-[#dfe8df] p-2 transition hover:bg-[#f1f5f0] disabled:opacity-40"
				>
					<ChevronLeft className="size-4" />
				</button>
				<span>
					Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}
				</span>
				<button
					type="button"
					aria-label="Trang sau"
					disabled={disabled || pagination.page >= pagination.totalPages}
					onClick={() => onPageChange(pagination.page + 1)}
					className="rounded-lg border border-[#dfe8df] p-2 transition hover:bg-[#f1f5f0] disabled:opacity-40"
				>
					<ChevronRight className="size-4" />
				</button>
			</div>
		</div>
	);
}
