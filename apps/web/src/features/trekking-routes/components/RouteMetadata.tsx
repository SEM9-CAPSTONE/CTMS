import { Clock3, Mountain, Route } from "lucide-react";
import type { CreatedTrekkingRoute } from "../types";
import { difficultyLabels, formatLength } from "../utils/route-presentation";

export function RouteMetadata({ route }: { route: CreatedTrekkingRoute }) {
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#52665b]">
			<span className="inline-flex items-center gap-1.5">
				<Mountain className="size-4 shrink-0" />
				{difficultyLabels[route.difficulty]}
			</span>
			<span className="inline-flex items-center gap-1.5">
				<Clock3 className="size-4 shrink-0" />
				{route.expectedDurationMinutes} phút
			</span>
			<span className="inline-flex items-center gap-1.5">
				<Route className="size-4 shrink-0" />
				{formatLength(route.lengthMeters)}
			</span>
		</div>
	);
}
