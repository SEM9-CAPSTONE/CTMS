import { ChevronLeft, ChevronRight, Compass, Loader2, RefreshCw } from "lucide-react";
import type { TripSummary, TripsPagination } from "../types";
import { TripCard } from "./TripCard";

export interface TripListProps {
	items: TripSummary[];
	pagination: TripsPagination | null;
	isLoading: boolean;
	error: string | null;
	onRetry: () => void;
	onSelectTrip: (tripId: string) => void;
	onPageChange: (page: number) => void;
}

export function TripList({
	items,
	pagination,
	isLoading,
	error,
	onRetry,
	onSelectTrip,
	onPageChange,
}: TripListProps) {
	if (isLoading) {
		return (
			<div data-testid="trips-loading" className="space-y-6">
				<div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-12 text-sm font-bold text-[#164027]">
					<Loader2 className="size-5 animate-spin" />
					<span>Đang tải danh sách chuyến đi...</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="animate-pulse rounded-2xl border border-[#dfe8df] bg-white p-3.5"
						>
							<div className="aspect-[16/10] w-full rounded-xl bg-slate-200" />
							<div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
							<div className="mt-2 h-3.5 w-1/2 rounded bg-slate-200" />
							<div className="mt-4 flex justify-between">
								<div className="h-5 w-16 rounded bg-slate-200" />
								<div className="h-7 w-20 rounded-xl bg-slate-200" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div
				role="alert"
				className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800 shadow-sm"
			>
				<p className="font-extrabold">{error}</p>
				<p className="mt-1 text-xs text-rose-600">
					Vui lòng kiểm tra kết nối mạng hoặc thử lại yêu cầu.
				</p>
				<button
					type="button"
					onClick={onRetry}
					className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-rose-700 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-rose-800"
				>
					<RefreshCw className="size-4" />
					<span>Tải lại</span>
				</button>
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div
				data-testid="trips-empty"
				className="rounded-3xl border border-dashed border-[#dfe8df] bg-white p-12 text-center"
			>
				<div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
					<Compass className="size-7" />
				</div>
				<h4 className="mt-4 text-base font-extrabold text-[#10221b]">
					Không tìm thấy chuyến đi nào phù hợp
				</h4>
				<p className="mt-1.5 text-xs text-[#667a6d]">
					Thử nới lỏng từ khóa hoặc bộ lọc mức giá, thời gian để tìm thêm hành trình.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Trip Grid */}
			<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				{items.map((trip) => (
					<TripCard key={trip.id} trip={trip} onSelect={onSelectTrip} />
				))}
			</div>

			{/* Pagination Bar */}
			{pagination && (
				<nav
					aria-label="Phân trang danh sách chuyến đi"
					className="flex flex-wrap items-center justify-between gap-4 border-t border-[#dfe8df] pt-6"
				>
					<p className="text-xs font-semibold text-[#667a6d]">
						Trang <strong className="text-[#10221b]">{pagination.page}</strong> /{" "}
						{pagination.totalPages || 1} (Tổng cộng {pagination.total} chuyến đi)
					</p>

					<div className="flex items-center gap-1.5">
						<button
							type="button"
							aria-label="Trang trước"
							disabled={pagination.page <= 1}
							onClick={() => onPageChange(pagination.page - 1)}
							className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-bold text-[#10221b] transition hover:bg-[#f6f9f6] disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronLeft className="size-4" />
							<span>Trang trước</span>
						</button>

						{Array.from({ length: Math.max(1, pagination.totalPages) }, (_, i) => i + 1).map(
							(p) => {
								const isCurrent = p === pagination.page;
								return (
									<button
										key={p}
										type="button"
										aria-label={`Trang ${p}`}
										aria-current={isCurrent ? "page" : undefined}
										onClick={() => onPageChange(p)}
										className={`min-w-9 rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
											isCurrent
												? "bg-[#164027] text-white shadow-sm"
												: "border border-[#dfe8df] bg-white text-[#10221b] hover:bg-[#f6f9f6]"
										}`}
									>
										{p}
									</button>
								);
							}
						)}

						<button
							type="button"
							aria-label="Trang sau"
							disabled={pagination.page >= pagination.totalPages}
							onClick={() => onPageChange(pagination.page + 1)}
							className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-bold text-[#10221b] transition hover:bg-[#f6f9f6] disabled:cursor-not-allowed disabled:opacity-40"
						>
							<span>Trang sau</span>
							<ChevronRight className="size-4" />
						</button>
					</div>
				</nav>
			)}
		</div>
	);
}
