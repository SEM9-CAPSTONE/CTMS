import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import type { TripDetails, TripStatus } from "../../trips/types";

type OperationalTrip = TripDetails & { displayStatus: TripStatus };
export type OperationalStatus = "ongoing" | "published";

const statusTabs: Array<{ key: OperationalStatus; label: string }> = [
	{ key: "ongoing", label: "Đang diễn ra" },
	{ key: "published", label: "Sắp khởi hành" },
];

export function HostOperationalTripSelector({
	trips,
	status,
	onStatusChange,
	selectedTripId,
	onSelect,
	compact = false,
	onlyOngoing = false,
}: {
	compact?: boolean;
	onlyOngoing?: boolean;
	trips: OperationalTrip[];
	status: OperationalStatus;
	onStatusChange: (status: OperationalStatus) => void;
	selectedTripId?: string;
	onSelect: (tripId: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const targetStatus = onlyOngoing ? "ongoing" : status;
	const filteredTrips = trips.filter((trip) => trip.displayStatus === targetStatus);
	const visibleTrips =
		compact && !expanded
			? filteredTrips.filter((trip) => trip.id === selectedTripId)
			: filteredTrips;
	return (
		<div aria-label="Chọn chuyến đi vận hành" className="mt-4 space-y-3">
			{!onlyOngoing && (
				<div className="flex flex-wrap items-center gap-2">
					<div className="mr-1 flex items-center gap-1.5 text-xs font-bold text-[#7b8c82]">
						<Filter className="size-3.5" />
						<span>Lọc trạng thái:</span>
					</div>
					{statusTabs.map((tab) => {
						const count = trips.filter((trip) => trip.displayStatus === tab.key).length;
						const isActive = status === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => onStatusChange(tab.key)}
								aria-pressed={isActive}
								className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
									isActive
										? "bg-[#164027] text-white shadow-sm shadow-[#164027]/20"
										: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7] hover:text-[#164027]"
								}`}
							>
								<span>{tab.label}</span>
								<span
									className={`rounded-full px-1.5 text-[10px] font-extrabold ${
										isActive ? "bg-white/20 text-white" : "bg-[#dfe8df] text-[#4a5e51]"
									}`}
								>
									{count}
								</span>
							</button>
						);
					})}
				</div>
			)}
			{compact && (
				<Button
					variant="outline"
					size="md"
					aria-expanded={expanded}
					className="w-full gap-2 rounded-lg border-emerald-800 bg-emerald-50 text-emerald-950 shadow-sm hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? (
						<ChevronUp className="size-4" aria-hidden="true" />
					) : (
						<ChevronDown className="size-4" aria-hidden="true" />
					)}
					<span className="font-semibold">
						{expanded ? "Thu gọn danh sách chuyến" : "Đổi chuyến"}
					</span>
				</Button>
			)}
			{filteredTrips.length ? (
				<div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
					{visibleTrips.map((trip) => (
						<Button
							key={trip.id}
							variant={selectedTripId === trip.id ? "primary" : "outline"}
							aria-pressed={selectedTripId === trip.id}
							onClick={() => {
								onSelect(trip.id);
								setExpanded(false);
							}}
							className={`justify-start rounded-xl border px-3 py-2 text-left text-sm font-bold ${selectedTripId === trip.id ? "border-[#164027] bg-[#164027] text-white" : "border-[#dfe8df] bg-white text-[#164027] hover:bg-[#f2f7ef]"}`}
						>
							<span>
								{trip.title}
								<span className="mt-1 block text-xs font-normal">
									{new Date(trip.startsAt).toLocaleDateString("vi-VN", {
										day: "2-digit",
										month: "2-digit",
										year: "numeric",
										timeZone: "Asia/Ho_Chi_Minh",
									})}
								</span>
							</span>
						</Button>
					))}
				</div>
			) : (
				<p className="text-sm text-[#667a6d]">
					{onlyOngoing
						? "Chưa có chuyến đi nào đang diễn ra."
						: "Không có chuyến đi nào ở trạng thái này."}
				</p>
			)}
		</div>
	);
}
