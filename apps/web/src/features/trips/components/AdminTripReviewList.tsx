import { Calendar, DoorOpen, Users } from "lucide-react";
import type { Trip } from "../types";

interface Props {
	items: Trip[];
	selectedId?: string;
	onSelect: (trip: Trip) => void;
}

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString("vi-VN");
}

const TRIP_TYPE_LABELS: Record<Trip["tripType"], string> = {
	day_trip: "Trong ngày",
	overnight: "Qua đêm",
};

export function AdminTripReviewList({ items, selectedId, onSelect }: Props) {
	return (
		<div className="space-y-3" aria-label="Danh sách trip chờ duyệt">
			{items.map((trip) => (
				<button
					key={trip.id}
					type="button"
					aria-label={`Xem xét trip ${trip.title}`}
					aria-pressed={trip.id === selectedId}
					onClick={() => onSelect(trip)}
					className={`w-full rounded-2xl border p-4 text-left transition ${
						trip.id === selectedId
							? "border-[#164027] bg-emerald-50 ring-2 ring-[#164027]/10"
							: "border-[#dfe8df] bg-white hover:border-[#9db5a3]"
					}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="font-extrabold text-[#10221b]">{trip.title}</h2>
						</div>
						<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
							Chờ duyệt
						</span>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#52665b]">
						<span className="flex items-center gap-1">
							<DoorOpen className="size-3.5" />
							{TRIP_TYPE_LABELS[trip.tripType]}
						</span>
						<span className="flex items-center gap-1">
							<Calendar className="size-3.5" />
							{formatDate(trip.startsAt)}
						</span>
						<span className="flex items-center gap-1">
							<Users className="size-3.5" />
							{trip.capacityMin}
							{trip.capacityMax != null ? `–${trip.capacityMax}` : "+"} khách
						</span>
					</div>
				</button>
			))}
		</div>
	);
}
