import { MapPin, Tent } from "lucide-react";
import type { CampsiteSearchItem } from "../types";

export interface CampsiteResultCardProps {
	campsite: CampsiteSearchItem;
}

/**
 * CTMS-17-T02 / BR-048 field fidelity: renders exactly what
 * CampsiteSearchItemDto carries -- name, location, cover image. No price
 * (that's a filter input, not a result field, per AC3) and no
 * "active routes" section: `activeRoutes` is always `[]` today (Trekking
 * Routes is a separate, unbuilt domain), so there is nothing real to show
 * -- rendering a placeholder for it would fabricate a feature that doesn't
 * exist yet.
 */
export function CampsiteResultCard({ campsite }: CampsiteResultCardProps) {
	return (
		<div className="overflow-hidden rounded-2xl border border-[#e0ebe0] bg-white shadow-sm transition hover:shadow-md">
			<div className="flex h-40 items-center justify-center bg-[#f1f5f0]">
				{campsite.coverImage ? (
					<img
						src={campsite.coverImage}
						alt={campsite.name}
						className="h-full w-full object-cover"
					/>
				) : (
					<Tent className="size-10 text-[#9aaba0]" />
				)}
			</div>
			<div className="p-4">
				<h3 className="truncate text-base font-extrabold text-[#10221b]">{campsite.name}</h3>
				<p className="mt-1 flex items-center gap-1.5 text-sm text-[#667a6d]">
					<MapPin className="size-4 shrink-0 text-[#276143]" />
					<span className="truncate">{campsite.location.province}</span>
				</p>
			</div>
		</div>
	);
}
