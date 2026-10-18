import { CalendarDays, CheckCircle2, Loader2, MapPin, RefreshCw, Route } from "lucide-react";
import { Pagination } from "../../../shared/components/Pagination";
import type { PorterLedTripHistoryItem } from "../types";

interface PorterLedTripHistoryProps {
	items: PorterLedTripHistoryItem[];
	isLoading: boolean;
	errorMessage: string | null;
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	onPageChange: (page: number) => void;
	onRetry: () => void;
}

function formatDateRange(startsAt: string, endsAt: string): string {
	const formatter = new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	return `${formatter.format(new Date(startsAt))} – ${formatter.format(new Date(endsAt))}`;
}

export function PorterLedTripHistory({
	items,
	isLoading,
	errorMessage,
	pagination,
	onPageChange,
	onRetry,
}: PorterLedTripHistoryProps) {
	return (
		<section
			data-testid="porter-led-trip-history"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm sm:p-8"
		>
			<div className="flex items-center justify-between gap-3 border-b border-[#e7eee7] pb-5">
				<div>
					<h2 className="text-lg font-extrabold text-[#10221b]">Lịch sử chuyến đi đã dẫn</h2>
					<p className="mt-0.5 text-xs text-[#627769]">
						Các chuyến đã hoàn thành với vai trò Trưởng nhóm được ghi nhận từ phân công chính thức.
					</p>
				</div>
				<button
					type="button"
					onClick={onRetry}
					disabled={isLoading}
					aria-label="Tải lại lịch sử chuyến đi"
					className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d2ded2] text-[#4a5e51] hover:bg-[#f4f7f2] disabled:opacity-50"
				>
					<RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
				</button>
			</div>

			{isLoading && items.length === 0 && (
				<div data-testid="led-trip-history-loading" className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-[#164027]" />
				</div>
			)}

			{errorMessage && (
				<div
					data-testid="led-trip-history-error"
					className="mt-5 flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
				>
					<p className="text-sm font-bold text-red-800">{errorMessage}</p>
					<button
						type="button"
						onClick={onRetry}
						className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700"
					>
						Thử lại
					</button>
				</div>
			)}

			{!isLoading && !errorMessage && items.length === 0 && (
				<div
					data-testid="led-trip-history-empty"
					className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#d2ded2] bg-[#f9fbf9] p-10 text-center"
				>
					<div className="flex size-14 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#164027]">
						<Route size={27} />
					</div>
					<h3 className="mt-3 font-extrabold text-[#10221b]">Chưa có chuyến đi đã dẫn</h3>
					<p className="mt-1 max-w-md text-xs text-[#627769]">
						Lịch sử sẽ hiển thị khi chuyến được phân công làm Trưởng nhóm đã hoàn thành.
					</p>
				</div>
			)}

			{!errorMessage && items.length > 0 && (
				<>
					<div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
						{items.map((item) => (
							<article
								key={item.tripId}
								data-testid={`led-trip-${item.tripId}`}
								className="rounded-2xl border border-[#dfe8df] bg-[#f8faf8] p-5"
							>
								<div className="flex items-start justify-between gap-3">
									<h3 className="font-extrabold text-[#10221b]">{item.tripTitle}</h3>
									<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
										<CheckCircle2 size={12} /> Đã hoàn thành
									</span>
								</div>
								<div className="mt-4 space-y-2 text-xs text-[#4a5e51]">
									<p className="flex items-center gap-2">
										<MapPin size={14} className="text-[#164027]" />
										<span>{item.routeName}</span>
									</p>
									<p className="flex items-center gap-2">
										<CalendarDays size={14} className="text-[#164027]" />
										<span>{formatDateRange(item.startsAt, item.endsAt)}</span>
									</p>
								</div>
								<p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-[#164027]">
									Vai trò: Trưởng nhóm
								</p>
							</article>
						))}
					</div>
					<Pagination
						currentPage={pagination.page}
						totalPages={pagination.totalPages}
						totalItems={pagination.total}
						itemsPerPage={pagination.limit}
						onPageChange={onPageChange}
					/>
				</>
			)}
		</section>
	);
}
