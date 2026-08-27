import { Clock3, MapPinned, Mountain, Route } from "lucide-react";
import type { AdminTrekkingRouteReview } from "../types";

interface Props {
	items: AdminTrekkingRouteReview[];
	selectedId?: string;
	onSelect: (route: AdminTrekkingRouteReview) => void;
}

function formatLength(meters: number): string {
	return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

export function AdminRouteReviewList({ items, selectedId, onSelect }: Props) {
	return (
		<div className="space-y-3" aria-label="Danh sách tuyến chờ duyệt">
			{items.map((route) => (
				<button
					key={route.id}
					type="button"
					aria-label={`Xem xét tuyến ${route.name}`}
					aria-pressed={route.id === selectedId}
					onClick={() => onSelect(route)}
					className={`w-full rounded-2xl border p-4 text-left transition ${
						route.id === selectedId
							? "border-[#164027] bg-emerald-50 ring-2 ring-[#164027]/10"
							: "border-[#dfe8df] bg-white hover:border-[#9db5a3]"
					}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="font-extrabold text-[#10221b]">{route.name}</h2>
							<p className="mt-1 text-xs font-semibold text-[#667a6d]">{route.campsiteName}</p>
						</div>
						<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
							Chờ duyệt
						</span>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#52665b]">
						<span className="flex items-center gap-1">
							<Mountain className="size-3.5" />
							{route.difficulty}
						</span>
						<span className="flex items-center gap-1">
							<Clock3 className="size-3.5" />
							{route.expectedDurationMinutes} phút
						</span>
						<span className="flex items-center gap-1">
							<Route className="size-3.5" />
							{formatLength(route.lengthMeters)}
						</span>
						<span className="flex items-center gap-1">
							<MapPinned className="size-3.5" />
							{route.checkpoints.length} checkpoint
						</span>
					</div>
				</button>
			))}
		</div>
	);
}
