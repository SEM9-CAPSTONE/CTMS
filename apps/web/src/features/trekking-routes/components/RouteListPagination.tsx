import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TrekkingRoutesPagination } from "../types";

export function routePageNumbers(current: number, total: number): Array<number | string> {
	if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
	const start = current <= 3 ? 1 : current >= total - 2 ? total - 2 : current - 1;
	const end = current <= 3 ? 3 : current >= total - 2 ? total : current + 1;
	const pages = [
		...new Set([1, ...Array.from({ length: end - start + 1 }, (_, i) => start + i), total]),
	].sort((a, b) => a - b);
	return pages.flatMap((page, index) =>
		index > 0 && page - pages[index - 1] > 1 ? [`gap-${page}`, page] : [page]
	);
}
export function RouteListPagination({
	pagination,
	onPageChange,
}: { pagination: TrekkingRoutesPagination; onPageChange: (page: number) => void }) {
	if (!pagination.totalPages) return null;
	const { page, totalPages } = pagination;
	const button =
		"flex size-8 items-center justify-center rounded-lg border border-[#dce6de] bg-white text-xs font-semibold text-[#34483b] hover:border-[#164027] disabled:cursor-not-allowed disabled:opacity-35";
	return (
		<nav
			aria-label="Phân trang danh sách tuyến"
			className="mt-auto flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-[#e0e8e2] bg-[#f7f9f7] px-3 py-3"
		>
			<span className="sr-only">
				Trang {page} trên {totalPages}, {pagination.total} tuyến
			</span>
			<button
				type="button"
				aria-label="Trang trước"
				className={button}
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
			>
				<ChevronLeft className="size-4" />
			</button>
			{routePageNumbers(page, totalPages).map((item) =>
				typeof item === "number" ? (
					<button
						key={item}
						type="button"
						aria-label={`Trang ${item}`}
						aria-current={item === page ? "page" : undefined}
						onClick={() => onPageChange(item)}
						className={
							item === page
								? "flex size-8 items-center justify-center rounded-lg bg-[#164d32] text-xs font-bold text-white shadow-sm"
								: button
						}
					>
						{item}
					</button>
				) : (
					<span key={item} className="px-1 text-sm text-slate-500">
						…
					</span>
				)
			)}
			<button
				type="button"
				aria-label="Trang sau"
				className={button}
				disabled={page >= totalPages}
				onClick={() => onPageChange(page + 1)}
			>
				<ChevronRight className="size-4" />
			</button>
		</nav>
	);
}
