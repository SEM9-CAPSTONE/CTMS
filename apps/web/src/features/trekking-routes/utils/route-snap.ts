import type { Position } from "../types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function pointDistance(first: Position, second: Position): number {
	return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function nearestPointOnSegment(position: Position, start: Position, finish: Position) {
	const segmentLongitude = finish[0] - start[0];
	const segmentLatitude = finish[1] - start[1];
	const segmentLengthSquared = segmentLongitude ** 2 + segmentLatitude ** 2;
	if (segmentLengthSquared === 0) return { point: start, ratio: 0, distanceSquared: 0 };
	const ratio = clamp(
		((position[0] - start[0]) * segmentLongitude + (position[1] - start[1]) * segmentLatitude) /
			segmentLengthSquared,
		0,
		1
	);
	const point: Position = [
		Number((start[0] + segmentLongitude * ratio).toFixed(6)),
		Number((start[1] + segmentLatitude * ratio).toFixed(6)),
	];
	return {
		point,
		ratio,
		distanceSquared: (position[0] - point[0]) ** 2 + (position[1] - point[1]) ** 2,
	};
}

/** Snaps a position onto the closest point of the route line and returns its 0..1 route order. */
export function nearestRoutePoint(
	position: Position,
	coordinates: Position[]
): { position: Position; routeOrder: number } {
	if (coordinates.length === 0) return { position, routeOrder: 0 };
	if (coordinates.length === 1) return { position: coordinates[0], routeOrder: 0 };
	const segmentLengths = coordinates
		.slice(0, -1)
		.map((coordinate, index) => pointDistance(coordinate, coordinates[index + 1]));
	const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
	let lengthBeforeSegment = 0;
	let bestLengthBeforeSegment = 0;
	let bestSegmentLength = segmentLengths[0] || 0;
	let bestRatio = 0;
	let nearestPosition = coordinates[0];
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < coordinates.length - 1; index += 1) {
		const projection = nearestPointOnSegment(position, coordinates[index], coordinates[index + 1]);
		if (projection.distanceSquared < nearestDistance) {
			nearestDistance = projection.distanceSquared;
			nearestPosition = projection.point;
			bestRatio = projection.ratio;
			bestSegmentLength = segmentLengths[index] || 0;
			bestLengthBeforeSegment = lengthBeforeSegment;
		}
		lengthBeforeSegment += segmentLengths[index] || 0;
	}
	const routeOrder =
		totalLength > 0 ? (bestLengthBeforeSegment + bestSegmentLength * bestRatio) / totalLength : 0;
	return {
		position: nearestPosition,
		routeOrder: Number(routeOrder.toFixed(6)),
	};
}
