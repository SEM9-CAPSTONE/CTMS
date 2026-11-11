import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditLogsPagination as Pagination } from "../types";

export interface AuditLogsPaginationProps {
	pagination: Pagination;
	disabled: boolean;
	onPageChange: (page: number) => void;
}

export function AuditLogsPagination({
	pagination,
	disabled,
	onPageChange,
}: AuditLogsPaginationProps) {
	return (
		<div className="flex flex-col gap-3 border-t border-[#e0ebe0] px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between bg-white">
			<p>
				Tổng cộng <strong className="text-[#10221b]">{pagination.total}</strong> nhật ký
			</p>
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label="Trang trước"
					disabled={disabled || pagination.page <= 1}
					onClick={() => onPageChange(pagination.page - 1)}
					className="rounded-lg border border-[#dfe8df] p-2 disabled:opacity-40 hover:bg-[#f1f5f0] transition"
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
					className="rounded-lg border border-[#dfe8df] p-2 disabled:opacity-40 hover:bg-[#f1f5f0] transition"
				>
					<ChevronRight className="size-4" />
				</button>
			</div>
		</div>
	);
}
