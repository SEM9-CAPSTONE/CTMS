import { TERRAIN_MAX_VERTICES } from "../../route-safety/terrain-constants";
import {
	RouteDirectionsError,
	RouteSnapDistanceError,
	fetchRouteDirections,
} from "../services/route-directions.service";
import {
	type GeoJsonLineString,
	type Position,
	ROUTE_DRAWING_MODES,
	type RouteDrawing,
	type RouteDrawingMode,
	type RouteSegment,
} from "../types";
import type { RouteLineHit } from "./route-line-hit";

export interface DrawingSnapshot {
	waypoints: Position[];
	segments: RouteSegment[];
}

export type SegmentDraft = Pick<RouteSegment, "id" | "mode"> & { geometry?: GeoJsonLineString };

export interface RouteEdit {
	waypoints: Position[];
	segments: SegmentDraft[];
	movable: number[];
}

const MAX_POLYLINE_ROUNDING_DEGREES = 0.000000500001;

export function samePosition(a: Position, b: Position): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

function hasLength(coordinates: Position[]): boolean {
	return coordinates.some((point) => !samePosition(point, coordinates[0]));
}

function matchesEncodedPosition(a: Position, b: Position): boolean {
	return a.every(
		(coordinate, index) => Math.abs(coordinate - b[index]) <= MAX_POLYLINE_ROUNDING_DEGREES
	);
}

function makeSegment(id: string, mode: RouteDrawingMode, coordinates: Position[]): RouteSegment {
	return {
		id,
		mode,
		start: coordinates[0],
		end: coordinates[coordinates.length - 1],
		geometry: { type: "LineString", coordinates },
	};
}

export function segmentDraft(mode: RouteDrawingMode): SegmentDraft {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return { id: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""), mode };
}

function restoreLegacySegments(
	coordinates: Position[],
	waypoints: Position[],
	mode: RouteDrawingMode
) {
	// Only recover a boundary if the old control point identifies one unambiguous vertex.
	const interiorIndices = new Map<string, number>();
	for (let index = 1; index < coordinates.length - 1; index++) {
		const key = coordinates[index].join(",");
		interiorIndices.set(key, interiorIndices.has(key) ? -1 : index);
	}
	const segments: RouteSegment[] = [];
	let from = 0;
	for (const waypoint of waypoints.slice(1, -1)) {
		const index = interiorIndices.get(waypoint.join(",")) ?? -1;
		if (index <= from) return undefined;
		segments.push(
			makeSegment(`legacy-${segments.length}`, mode, coordinates.slice(from, index + 1))
		);
		from = index;
	}
	segments.push(makeSegment(`legacy-${segments.length}`, mode, coordinates.slice(from)));
	return segments.every((segment) => hasLength(segment.geometry.coordinates))
		? segments
		: undefined;
}

export function restoreDrawing(value: GeoJsonLineString, drawing?: RouteDrawing): DrawingSnapshot {
	const { coordinates } = value;
	if (coordinates.length < 2) return { waypoints: coordinates, segments: [] };
	let segments: RouteSegment[] | undefined;
	if (drawing?.mode === "hybrid" && Array.isArray(drawing.segments)) {
		let startIndex = 0;
		const restored = drawing.segments.map(({ id, mode, endIndex }) => {
			const segment = makeSegment(id, mode, coordinates.slice(startIndex, endIndex + 1));
			startIndex = endIndex;
			return segment;
		});
		if (
			restored.length &&
			startIndex === coordinates.length - 1 &&
			restored.every((segment) => segment.geometry.coordinates.length >= 2)
		) {
			segments = restored;
		}
	}
	if (drawing?.mode === ROUTE_DRAWING_MODES.SMART || drawing?.mode === ROUTE_DRAWING_MODES.MANUAL) {
		segments = restoreLegacySegments(coordinates, drawing.waypoints, drawing.mode);
	}
	// Without saved boundaries an existing line is preserved as a single editable segment.
	segments ??= [
		makeSegment(
			"legacy-0",
			drawing?.mode === ROUTE_DRAWING_MODES.SMART ? drawing.mode : ROUTE_DRAWING_MODES.MANUAL,
			coordinates
		),
	];
	return { waypoints: [segments[0].start, ...segments.map((segment) => segment.end)], segments };
}

export function serializeDrawing({ waypoints, segments }: DrawingSnapshot) {
	const coordinates: Position[] = [];
	const boundaries = segments.map(({ id, mode, geometry }, index) => {
		for (const point of geometry.coordinates.slice(index === 0 ? 0 : 1)) coordinates.push(point);
		return { id, mode, endIndex: coordinates.length - 1 };
	});
	const geometry: GeoJsonLineString = { type: "LineString", coordinates };
	const drawing: RouteDrawing | undefined = segments.length
		? { mode: "hybrid", waypoints, segments: boundaries }
		: undefined;
	return { geometry, drawing };
}

export function insertDrawingPoint(
	snapshot: DrawingSnapshot,
	hit: RouteLineHit
): DrawingSnapshot | undefined {
	let localEdge = hit.edgeIndex;
	for (const [index, segment] of snapshot.segments.entries()) {
		const { coordinates } = segment.geometry;
		if (localEdge >= coordinates.length - 1) {
			localEdge -= coordinates.length - 1;
			continue;
		}
		const start = coordinates[localEdge];
		const end = coordinates[localEdge + 1];
		let point = start;
		if (hit.fraction === 1) point = end;
		else if (hit.fraction > 0) {
			point = [
				Number((start[0] + (end[0] - start[0]) * hit.fraction).toFixed(9)),
				Number((start[1] + (end[1] - start[1]) * hit.fraction).toFixed(9)),
			];
		}
		const before = coordinates.slice(0, localEdge + 1);
		const after = coordinates.slice(localEdge + 1);
		if (!samePosition(start, point)) before.push(point);
		if (!samePosition(end, point)) after.unshift(point);
		if (!hasLength(before) || !hasLength(after)) return undefined;
		if (
			!samePosition(start, point) &&
			!samePosition(end, point) &&
			snapshot.segments.reduce((count, item) => count + item.geometry.coordinates.length - 1, 1) >=
				TERRAIN_MAX_VERTICES
		)
			throw new RouteEditError("Tuyến đường đã đạt giới hạn 10.000 tọa độ.");
		return {
			waypoints: [
				...snapshot.waypoints.slice(0, index + 1),
				point,
				...snapshot.waypoints.slice(index + 1),
			],
			segments: [
				...snapshot.segments.slice(0, index),
				makeSegment(segment.id, segment.mode, before),
				makeSegment(segmentDraft(segment.mode).id, segment.mode, after),
				...snapshot.segments.slice(index + 1),
			],
		};
	}
	return undefined;
}

export class RouteEditError extends Error {}

export async function resolveRouteEdit(
	edit: RouteEdit,
	signal: AbortSignal
): Promise<DrawingSnapshot> {
	const waypoints = [...edit.waypoints];
	const movable = new Set(edit.movable);
	const routed = new Map<number, Position[]>();
	for (const [index, segment] of edit.segments.entries()) {
		if (segment.geometry || segment.mode !== ROUTE_DRAWING_MODES.SMART) continue;
		signal.throwIfAborted();
		try {
			const geometry = await fetchRouteDirections(waypoints.slice(index, index + 2), signal);
			const { coordinates } = geometry;
			for (const [waypointIndex, snapped] of [
				[index, coordinates[0]],
				[index + 1, coordinates[coordinates.length - 1]],
			] as const) {
				if (movable.delete(waypointIndex)) waypoints[waypointIndex] = snapped;
				else if (!matchesEncodedPosition(waypoints[waypointIndex], snapped)) {
					throw new RouteEditError(
						"Chưa tìm được đường đi bộ nối liền với đoạn đã vẽ. Hãy kéo điểm vẽ đến vị trí khác."
					);
				}
			}
			// Normalize only provider rounding at fixed endpoints. No connector vertices are added.
			const normalized = [waypoints[index], ...coordinates.slice(1, -1), waypoints[index + 1]];
			routed.set(index, normalized);
		} catch (error) {
			if (error instanceof RouteEditError) throw error;
			if (error instanceof RouteSnapDistanceError) {
				throw new RouteEditError(error.messageForRoute(index));
			}
			throw new RouteEditError(
				error instanceof RouteDirectionsError
					? error.message
					: "Không thể tìm đường. Vui lòng thử lại."
			);
		}
	}
	let vertexCount = edit.segments.length ? 1 : 0;
	const segments = edit.segments.map((segment, index) => {
		const start = waypoints[index];
		const end = waypoints[index + 1];
		const coordinates = segment.geometry?.coordinates ?? routed.get(index) ?? [start, end];
		if (!hasLength(coordinates)) {
			throw new RouteEditError("Đoạn tuyến phải có độ dài lớn hơn không. Hãy chọn vị trí khác.");
		}
		if (
			!samePosition(coordinates[0], start) ||
			!samePosition(coordinates[coordinates.length - 1], end)
		) {
			throw new RouteEditError("Các đoạn tuyến chưa nối liền nhau.");
		}
		vertexCount += coordinates.length - 1;
		if (vertexCount > TERRAIN_MAX_VERTICES) {
			throw new RouteEditError(
				"Tuyến đường vượt quá giới hạn 10.000 tọa độ. Hãy chia thành các tuyến ngắn hơn."
			);
		}
		return makeSegment(segment.id, segment.mode, coordinates);
	});
	return { waypoints, segments };
}
