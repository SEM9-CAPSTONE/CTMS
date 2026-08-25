import { Button } from "./Button";

export interface PaginationProps {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	onPageChange: (page: number) => void;
}

export function Pagination({
	currentPage,
	totalPages,
	totalItems,
	itemsPerPage,
	onPageChange,
}: PaginationProps) {
	if (totalPages <= 1) {
		return null;
	}

	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPage * itemsPerPage, totalItems);

	return (
		<div className="mt-4 flex items-center justify-between border-t border-[#e5eee7] pt-4">
			<p className="text-xs font-bold text-[#667a6d]">
				Hiển thị dòng {startItem} - {endItem} trong tổng số {totalItems}
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage === 1}
					onClick={() => onPageChange(currentPage - 1)}
					className="text-xs"
				>
					Trở trước
				</Button>
				<span className="text-xs font-bold text-[#164027] px-2">
					Trang {currentPage} / {totalPages}
				</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage === totalPages}
					onClick={() => onPageChange(currentPage + 1)}
					className="text-xs"
				>
					Tiếp theo
				</Button>
			</div>
		</div>
	);
}
