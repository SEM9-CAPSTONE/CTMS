import type { Position } from "../types";

type Pixel = { x: number; y: number };
export type RouteLineHit = { edgeIndex: number; fraction: number };

export function findRouteLineHit(
	coordinates: Position[],
	click: Pixel,
	project: (position: Position) => Pixel,
	tolerance: number
): RouteLineHit | undefined {
	let best: RouteLineHit | undefined;
	let closestSquared = tolerance * tolerance;
	if (coordinates.length < 2) return best;
	let start = project(coordinates[0]);
	for (let edgeIndex = 0; edgeIndex < coordinates.length - 1; edgeIndex++) {
		const end = project(coordinates[edgeIndex + 1]);
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const lengthSquared = dx * dx + dy * dy;
		if (lengthSquared > 0) {
			const projection = ((click.x - start.x) * dx + (click.y - start.y) * dy) / lengthSquared;
			// Leave the drawing area beyond either end available for appending.
			if (
				(edgeIndex === 0 && projection < 0) ||
				(edgeIndex === coordinates.length - 2 && projection > 1)
			) {
				start = end;
				continue;
			}
			const fraction = Math.max(0, Math.min(1, projection));
			const distanceSquared =
				(click.x - start.x - dx * fraction) ** 2 + (click.y - start.y - dy * fraction) ** 2;
			if (distanceSquared <= closestSquared) {
				closestSquared = distanceSquared;
				best = { edgeIndex, fraction };
			}
		}
		start = end;
	}
	return best;
}
