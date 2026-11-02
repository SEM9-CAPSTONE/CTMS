import type { GeoJsonLineString } from "../../trekking-routes/types";
import { approximateLengthMeters } from "../../trekking-routes/utils/route-import";
import { TERRAIN_MAX_VERTICES, TERRAIN_WALKING_KMH } from "../terrain-constants";
import type { TerrainResult } from "../terrain-types";

export function terrainAdvice(
	geometry: GeoJsonLineString,
	duration: string,
	terrain?: TerrainResult
) {
	const coordinatesValid =
		geometry.coordinates.length >= 2 &&
		geometry.coordinates.length <= TERRAIN_MAX_VERTICES &&
		geometry.coordinates.every(
			([lng, lat]) =>
				Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
		);
	const distanceMeters = coordinatesValid ? approximateLengthMeters(geometry.coordinates) : 0;
	const valid = coordinatesValid && distanceMeters > 0;
	const minutes = Number(duration);
	const speedKmh =
		valid && minutes > 0 && Number.isFinite(minutes)
			? distanceMeters / 1000 / (minutes / 60)
			: null;
	const basicMinutes = Math.max(
		1,
		Math.ceil(Number(((distanceMeters / 1000 / TERRAIN_WALKING_KMH) * 60).toFixed(9)))
	);
	const minimumMinutes =
		terrain?.status === "READY" && Number.isFinite(terrain.minimumMinutes)
			? Math.max(basicMinutes, terrain.minimumMinutes)
			: basicMinutes;
	const estimatedMinutes = terrain?.estimatedMinutes ?? basicMinutes;
	const warning = speedKmh !== null && minutes < minimumMinutes;
	return { valid, distanceMeters, speedKmh, estimatedMinutes, minimumMinutes, warning };
}
