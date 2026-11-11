import type { GeoJsonPoint, Position } from "../types";

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface CoordinateBounds {
	minLongitude: number;
	maxLongitude: number;
	minLatitude: number;
	maxLatitude: number;
}

export function routeBounds(coordinates: Position[], paddingRatio = 0.08): CoordinateBounds {
	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	const minLongitude = Math.min(...longitudes);
	const maxLongitude = Math.max(...longitudes);
	const minLatitude = Math.min(...latitudes);
	const maxLatitude = Math.max(...latitudes);
	const longitudePadding = Math.max((maxLongitude - minLongitude) * paddingRatio, 0.001);
	const latitudePadding = Math.max((maxLatitude - minLatitude) * paddingRatio, 0.001);
	return {
		minLongitude: minLongitude - longitudePadding,
		maxLongitude: maxLongitude + longitudePadding,
		minLatitude: minLatitude - latitudePadding,
		maxLatitude: maxLatitude + latitudePadding,
	};
}

export function coordinateToPercent(
	[longitude, latitude]: Position,
	bounds: CoordinateBounds
): Position {
	return [
		((longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude)) * 100,
		100 - ((latitude - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude)) * 100,
	];
}

export function percentToCoordinate([x, y]: Position, bounds: CoordinateBounds): Position {
	return [
		bounds.minLongitude + (x / 100) * (bounds.maxLongitude - bounds.minLongitude),
		bounds.minLatitude + ((100 - y) / 100) * (bounds.maxLatitude - bounds.minLatitude),
	];
}

export function geodesicCircle(center: GeoJsonPoint, radiusMeters: number, segments = 64) {
	const [longitude, latitude] = center.coordinates;
	const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
	const latitudeRadians = (latitude * Math.PI) / 180;
	const longitudeRadians = (longitude * Math.PI) / 180;
	const coordinates: Position[] = [];

	for (let index = 0; index <= segments; index += 1) {
		const bearing = (index / segments) * Math.PI * 2;
		const targetLatitude = Math.asin(
			Math.sin(latitudeRadians) * Math.cos(angularDistance) +
				Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing)
		);
		const targetLongitude =
			longitudeRadians +
			Math.atan2(
				Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
				Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(targetLatitude)
			);
		coordinates.push([(targetLongitude * 180) / Math.PI, (targetLatitude * 180) / Math.PI]);
	}

	return {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "Polygon" as const, coordinates: [coordinates] },
	};
}
