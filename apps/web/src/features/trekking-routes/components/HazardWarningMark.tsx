import { SafetySymbol } from "../../route-safety/components/SafetySymbol";
import { HAZARD_MARKER_COLOR } from "../../route-safety/map-symbols";

/** Fallback SVG warning sign for a point hazard, sized in the map's percentage viewBox. */
export function HazardWarningMark({ x, y }: { x: number; y: number }) {
	return (
		<g transform={`translate(${x - 4}, ${y - 4})`}>
			<SafetySymbol kind="hazard" color={HAZARD_MARKER_COLOR} size={8} />
		</g>
	);
}
