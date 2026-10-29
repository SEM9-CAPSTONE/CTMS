import { useRef, useState } from "react";
import { cn } from "../../../shared/utils/cn";
import { useInventoryPagination } from "../hooks/useInventoryPagination";
import type { HostOverview, OverviewInventoryTab } from "../types";
import { OverviewInventoryPanel } from "./OverviewInventoryPanel";
import { OverviewListPagination } from "./OverviewListPagination";

const tabs = [
	{ key: "bookings", label: "Booking hôm nay" },
	{ key: "porters", label: "Porter" },
	{ key: "routes", label: "Tuyến" },
] as const;
type InventoryTab = OverviewInventoryTab;
function initialTab(data: HostOverview): InventoryTab {
	if (data.bookings.availability !== "available" || data.bookings.data?.total !== 0)
		return "bookings";
	if (data.routes.data && data.routes.data.total > 0) return "routes";
	if (data.porters.data && data.porters.data.total > 0) return "porters";
	return "bookings";
}
export function OverviewInventory({
	hostId,
	data,
	onTrip,
	onRestricted,
}: { hostId: string; data: HostOverview; onTrip: (id: string) => void; onRestricted: () => void }) {
	const [active, setActive] = useState<InventoryTab>(() => initialTab(data));
	const { query, page, setPage } = useInventoryPagination(hostId, active, onRestricted);
	const total = query.data
		? (query.data[active].data?.total ?? null)
		: (data[active].data?.total ?? null);
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);
	return (
		<div className="flex min-w-0 flex-col rounded-2xl border border-[#e0e7df] bg-white p-5 shadow-[0_2px_6px_#183a2805] lg:min-h-[500px]">
			<div
				role="tablist"
				aria-label="Danh sách vận hành"
				className="mb-4 flex gap-1 rounded-xl bg-[#f2f5f0] p-1"
			>
				{tabs.map(({ key, label }, index) => (
					<button
						key={key}
						type="button"
						role="tab"
						id={`overview-tab-${key}`}
						aria-controls={`overview-panel-${key}`}
						aria-selected={active === key}
						tabIndex={active === key ? 0 : -1}
						ref={(element) => {
							buttons.current[index] = element;
						}}
						onClick={() => setActive(key)}
						onKeyDown={(event) => {
							let next = index;
							if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
							else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
							else if (event.key === "Home") next = 0;
							else if (event.key === "End") next = tabs.length - 1;
							else return;
							event.preventDefault();
							setActive(tabs[next].key);
							buttons.current[next]?.focus();
						}}
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold outline-offset-4 sm:text-sm",
							active === key
								? "bg-[#23583b] text-white shadow-sm"
								: "text-[#6c7b71] hover:bg-white hover:text-[#23583b]"
						)}
					>
						{label}
						<span
							className={
								active === key
									? "rounded px-1.5 py-0.5 text-[10px] bg-white/15 text-white"
									: "rounded bg-white px-1.5 py-0.5 text-[10px] text-[#6c7b71]"
							}
						>
							{(key === active && query.data
								? query.data[key].data?.total
								: data[key].data?.total) ?? "—"}
						</span>
					</button>
				))}
			</div>
			<div
				role="tabpanel"
				className="min-h-0 flex-1"
				id={`overview-panel-${active}`}
				aria-labelledby={`overview-tab-${active}`}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: Tabpanels need a focus target after their selected tab.
				tabIndex={0}
			>
				<OverviewInventoryPanel
					active={active}
					data={query.data}
					loading={query.isPending}
					restricted={query.restricted}
					stale={query.stale}
					onRetry={() => {
						void query.refetch();
					}}
					onTrip={onTrip}
				/>
			</div>
			{!query.restricted && (
				<OverviewListPagination
					label={
						active === "routes"
							? "Tuyến"
							: (tabs.find((tab) => tab.key === active)?.label ?? active)
					}
					total={total}
					page={page}
					limit={query.data?.limit ?? data.limit}
					busy={query.isFetching}
					onPage={setPage}
				/>
			)}
		</div>
	);
}
