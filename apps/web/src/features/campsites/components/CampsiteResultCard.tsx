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
	const handleCardClick = () => {
		window.history.pushState({}, "", `/campsites/${campsite.id}`);
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<div
			id={`campsite-card-${campsite.id}`}
			onClick={handleCardClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handleCardClick();
				}
			}}
			tabIndex={0}
			// biome-ignore lint/a11y/useSemanticElements: using div with button role to allow grid card styling
			role="button"
			className="group overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-md shadow-[#1c442f]/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#1c442f]/12 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#164027]/20"
		>
			<div className="relative h-50 bg-[#f1f5f0] flex items-center justify-center overflow-hidden">
				{campsite.coverImage ? (
					<img
						src={campsite.coverImage}
						alt={campsite.name}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<Tent className="size-10 text-[#9aaba0]" />
				)}
				<span className="absolute top-3.5 right-3.5 rounded-full bg-white/94 px-3 py-1 text-xs font-extrabold text-[#d87d05] shadow-sm backdrop-blur-sm">
					★ 4.8
				</span>
			</div>
			<div className="p-5">
				<h3 className="mb-1 text-lg font-extrabold text-[#10221b] truncate">{campsite.name}</h3>
				<p className="mb-3.5 text-xs font-medium text-[#425048] flex items-center gap-1.5">
					<MapPin className="size-3.5 shrink-0 text-[#276143]" />
					<span className="truncate">{campsite.location.province}</span>
				</p>
				<div className="mb-4 flex flex-wrap gap-1.5">
					<span className="rounded-lg bg-[#eef7f0] px-2.5 py-1 text-xs font-bold text-[#276143]">
						Nắng ấm
					</span>
					<span className="rounded-lg bg-[#f4f6f4] px-2.5 py-1 text-xs font-bold text-[#425048]">
						Hoạt động
					</span>
				</div>
				<div className="flex items-center justify-between border-t border-dashed border-[#dfe8df] pt-3.5">
					<span className="text-base font-extrabold text-[#1c442f]">Chỉ từ 150k</span>
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#10221b] transition hover:bg-[#f7faf6]"
					>
						Xem chi tiết
					</button>
				</div>
			</div>
		</div>
	);
}
