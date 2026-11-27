import { AlertTriangle } from "lucide-react";
import type { CSSProperties } from "react";
import { type SafetySymbolKind, WATER_SYMBOL_PATHS } from "../map-symbols";

export function SafetySymbol({
	kind,
	color,
	outlined = true,
	size = 20,
}: {
	kind: SafetySymbolKind;
	color: string;
	outlined?: boolean;
	size?: number;
}) {
	if (kind === "hazard")
		return (
			<AlertTriangle
				aria-hidden="true"
				size={size}
				color="#991b1b"
				style={{ "--hazard-fill": color } as CSSProperties}
				className="shrink-0 [&>path:first-child]:fill-[var(--hazard-fill)] [&>path:first-child]:stroke-none"
			/>
		);
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
			<path
				d={WATER_SYMBOL_PATHS.shape}
				fill={color}
				stroke={outlined ? "white" : "none"}
				strokeWidth="1.5"
			/>
			<path
				d={WATER_SYMBOL_PATHS.mark}
				fill="none"
				stroke="white"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}
