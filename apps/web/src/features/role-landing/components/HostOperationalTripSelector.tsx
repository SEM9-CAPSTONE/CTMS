import type { TripDetails, TripStatus } from "../../trips/types";

type OperationalTrip = TripDetails & { displayStatus: TripStatus };

export function HostOperationalTripSelector({
	trips,
	selectedTripId,
	onSelect,
}: {
	trips: OperationalTrip[];
	selectedTripId?: string;
	onSelect: (tripId: string) => void;
}) {
	return (
		<div aria-label="Chọn chuyến đi vận hành" className="mt-4 space-y-4">
			{(["ongoing", "published"] as const).map((status) => {
				const group = trips.filter((trip) => trip.displayStatus === status);
				if (!group.length) return null;
				return (
					<div key={status}>
						<p className="mb-2 text-sm font-bold text-[#667a6d]">
							{status === "ongoing" ? "Đang diễn ra" : "Sắp khởi hành"} ({group.length})
						</p>
						<div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
							{group.map((trip) => (
								<Button
									key={trip.id}
									variant={selectedTripId === trip.id ? "primary" : "outline"}
									aria-pressed={selectedTripId === trip.id}
									onClick={() => onSelect(trip.id)}
									className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${selectedTripId === trip.id ? "border-[#164027] bg-[#164027] text-white" : "border-[#dfe8df] bg-white text-[#164027] hover:bg-[#f2f7ef]"}`}
								>
									{trip.title}
									{(trip.weatherRiskLevel === "yellow" || trip.weatherRiskLevel === "red") && (
										<span className="ml-2 text-xs">· Có cảnh báo</span>
									)}
								</Button>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
import { Button } from "../../../shared/components/Button";
