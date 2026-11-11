import { Filter } from "lucide-react";
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
}: {
	trips: OperationalTrip[];
	status: OperationalStatus;
	onStatusChange: (status: OperationalStatus) => void;
	selectedTripId?: string;
	onSelect: (tripId: string) => void;
}) {
	const filteredTrips = trips.filter((trip) => trip.displayStatus === status);
	return (
		<div aria-label="Chọn chuyến đi vận hành" className="mt-4 space-y-3">
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
			{filteredTrips.length ? (
				<div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
					{filteredTrips.map((trip) => (
						<Button
							key={trip.id}
							variant={selectedTripId === trip.id ? "primary" : "outline"}
							aria-pressed={selectedTripId === trip.id}
							onClick={() => onSelect(trip.id)}
							className={`justify-start rounded-xl border px-3 py-2 text-left text-sm font-bold ${selectedTripId === trip.id ? "border-[#164027] bg-[#164027] text-white" : "border-[#dfe8df] bg-white text-[#164027] hover:bg-[#f2f7ef]"}`}
						>
							{trip.title}
						</Button>
					))}
				</div>
			) : (
				<p className="text-sm text-[#667a6d]">Không có chuyến đi nào ở trạng thái này.</p>
			)}
		</div>
	);
}
