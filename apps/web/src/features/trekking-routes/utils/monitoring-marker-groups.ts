export const MONITORING_CLUSTER = {
	cellSize: 52,
	minParticipants: 3,
	fallbackCellSize: 8,
	maxZoom: 18,
} as const;

/** Group markers by rendered screen area without changing any stored coordinate. */
export function groupMonitoringMarkers<T>(
	markers: readonly T[],
	project: (marker: T) => { x: number; y: number },
	cellSize: number = MONITORING_CLUSTER.cellSize
): T[][] {
	const cells = new Map<string, T[]>();
	for (const marker of markers) {
		const point = project(marker);
		const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
		const group = cells.get(key) ?? [];
		group.push(marker);
		cells.set(key, group);
	}
	return [...cells.values()].flatMap((group) =>
		group.length >= MONITORING_CLUSTER.minParticipants ? [group] : group.map((marker) => [marker])
	);
}
