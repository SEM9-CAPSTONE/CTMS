import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import type { HostOverview } from "../types";
import { overviewDate } from "../utils";

export function OverviewToolbar({
	data,
	pages,
	busy,
	onPrevious,
	onNext,
	onRefresh,
}: {
	data: HostOverview;
	pages: number;
	busy: boolean;
	onPrevious: () => void;
	onNext: () => void;
	onRefresh: () => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 className="text-base font-semibold text-[#233c2c]">Hoạt động & cảnh báo</h2>
				<p className="mt-1 text-[11px] text-[#7c8b80]">
					Cập nhật {overviewDate(data.generatedAt, data.timeZone)} · {data.timeZone}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				{pages > 1 && (
					<nav
						aria-label="Phân trang chuyến đi và cảnh báo"
						className="flex items-center gap-1 rounded-lg border border-[#dfe7dc] bg-white px-1 py-1"
					>
						<Button
							size="sm"
							variant="ghost"
							aria-label={text.previous}
							disabled={data.page <= 1 || busy}
							onClick={onPrevious}
						>
							<ChevronLeft aria-hidden="true" className="size-4" />
						</Button>
						<div className="px-2 text-center">
							<p className="text-xs font-medium text-[#3e5545]">
								Trang {data.page} / {Math.max(data.page, pages)}
							</p>
							<p className="text-[10px] text-[#829087]">Trip · SOS · thời tiết</p>
						</div>
						<Button
							size="sm"
							variant="ghost"
							aria-label={text.next}
							disabled={data.page >= pages || busy}
							onClick={onNext}
						>
							<ChevronRight aria-hidden="true" className="size-4" />
						</Button>
					</nav>
				)}
				<Button size="sm" variant="outline" className="gap-2" disabled={busy} onClick={onRefresh}>
					<RefreshCw aria-hidden="true" className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
					{busy ? text.refreshing : text.refresh}
				</Button>
			</div>
		</div>
	);
}
