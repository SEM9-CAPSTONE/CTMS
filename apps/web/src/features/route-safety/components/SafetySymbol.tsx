import { SYMBOL_PATHS, type SafetySymbolKind } from "../map-symbols";

export function SafetySymbol({ kind, color }: { kind: SafetySymbolKind; color: string }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
			<path d={SYMBOL_PATHS[kind].shape} fill={color} stroke="white" strokeWidth="1.5" />
			<path
				d={SYMBOL_PATHS[kind].mark}
				fill="none"
				stroke="white"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}
