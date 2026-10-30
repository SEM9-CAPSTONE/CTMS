import { AlertTriangle, ChevronRight } from "lucide-react";
import type { CreatedTrekkingRoute } from "../types";
import { formatCreatedAt } from "../utils/route-presentation";
import { RouteMetadata } from "./RouteMetadata";
import { RouteStatusBadge } from "./RouteStatusBadge";
export { difficultyLabels, formatLength, statusLabels } from "../utils/route-presentation";
interface TrekkingRouteListProps {
	items: CreatedTrekkingRoute[];
	selectedRouteId?: string;
	onSelect: (route: CreatedTrekkingRoute) => void;
}
export function TrekkingRouteList({ items, selectedRouteId, onSelect }: TrekkingRouteListProps) {
	return (
		<div className="grid gap-3" aria-label="Danh sách tuyến đường">
			{items.map((route) => {
				const selected = route.id === selectedRouteId;
				return (
					<article
						key={route.id}
						className={
							selected
								? "rounded-2xl border border-[#387757] bg-[#eff8f2] shadow-sm"
								: "rounded-2xl border border-[#dfe6e0] bg-white transition hover:border-[#93af9b]"
						}
					>
						<button
							type="button"
							aria-pressed={selected}
							onClick={() => onSelect(route)}
							className="w-full p-4 text-left sm:p-5"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<h3 className="line-clamp-2 text-base font-extrabold text-[#10221b]">
										{route.name}
									</h3>
									<p className="mt-1 text-xs text-[#667a6d]">
										Tạo lúc {formatCreatedAt(route.createdAt)}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<RouteStatusBadge status={route.status} />
									<ChevronRight className="size-4 text-[#34483b]" />
								</div>
							</div>
							<div className="mt-4">
								<RouteMetadata route={route} />
							</div>
						</button>
						{route.status === "draft" && route.latestRejectionReason && (
							<div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
								<p className="flex items-center gap-2 font-bold">
									<AlertTriangle className="size-4 shrink-0" />
									Admin yêu cầu chỉnh sửa
								</p>
								<p className="mt-1 whitespace-pre-wrap break-words">
									{route.latestRejectionReason}
								</p>
							</div>
						)}
					</article>
				);
			})}
		</div>
	);
}
