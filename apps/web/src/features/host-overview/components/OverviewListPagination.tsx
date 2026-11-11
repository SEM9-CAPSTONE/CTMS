import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../shared/components/Button";

export function OverviewListPagination({
	label,
	total,
	page,
	limit,
	busy,
	onPage,
}: {
	label: string;
	total: number | null;
	page: number;
	limit: number;
	busy: boolean;
	onPage: (page: number) => void;
}) {
	if (total === null || (total <= limit && page === 1)) return null;
	const pages = Math.max(1, Math.ceil(total / limit));
	const start = total === 0 || (page - 1) * limit >= total ? 0 : (page - 1) * limit + 1;
	const end = Math.min(page * limit, total);
	return (
		<nav
			aria-label={`Phân trang ${label}`}
			className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1ec] pt-3"
		>
			<span className="text-xs text-[#7c8b80]">
				{start}–{end} / {total} {label.toLowerCase()}
			</span>
			<div className="flex items-center gap-2">
				<Button
					size="sm"
					variant="outline"
					disabled={page <= 1 || busy}
					onClick={() => onPage(page - 1)}
					className="gap-1"
				>
					<ChevronLeft aria-hidden="true" className="size-3.5" />
					Trước
				</Button>
				<span className="text-xs tabular-nums text-[#526b59]">
					{page} / {Math.max(page, pages)}
				</span>
				<Button
					size="sm"
					variant="outline"
					disabled={page >= pages || busy}
					onClick={() => onPage(page + 1)}
					className="gap-1"
				>
					Sau
					<ChevronRight aria-hidden="true" className="size-3.5" />
				</Button>
			</div>
		</nav>
	);
}
