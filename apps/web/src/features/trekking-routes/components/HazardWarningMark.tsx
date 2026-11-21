/** Fallback SVG warning sign for a point hazard, sized in the map's percentage viewBox. */
export function HazardWarningMark({ x, y, color }: { x: number; y: number; color: string }) {
	return (
		<>
			<polygon
				points={`${x},${y - 3.6} ${x + 3.8},${y + 2.8} ${x - 3.8},${y + 2.8}`}
				fill={color}
			/>
			<text x={x} y={y + 2.1} textAnchor="middle" fontSize="4" fontWeight="900" fill="white">
				!
			</text>
		</>
	);
}
