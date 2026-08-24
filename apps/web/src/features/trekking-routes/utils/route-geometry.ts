import type { GeoJsonLineString, Position } from "../types";

export const emptyLineString = (): GeoJsonLineString => ({ type: "LineString", coordinates: [] });

export function addVertex(geometry: GeoJsonLineString, position: Position): GeoJsonLineString {
	return { type: "LineString", coordinates: [...geometry.coordinates, position] };
}

export function moveVertex(
	geometry: GeoJsonLineString,
	index: number,
	position: Position
): GeoJsonLineString {
	if (index < 0 || index >= geometry.coordinates.length) return geometry;
	const coordinates = [...geometry.coordinates] as Position[];
	coordinates[index] = position;
	return { type: "LineString", coordinates };
}

export function removeVertex(geometry: GeoJsonLineString, index: number): GeoJsonLineString {
	if (index < 0 || index >= geometry.coordinates.length) return geometry;
	return {
		type: "LineString",
		coordinates: geometry.coordinates.filter((_, vertexIndex) => vertexIndex !== index),
	};
}

export function removeLastVertex(geometry: GeoJsonLineString): GeoJsonLineString {
	return { type: "LineString", coordinates: geometry.coordinates.slice(0, -1) };
}
