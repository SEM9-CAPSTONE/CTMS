import { estimateRouteDuration } from "./route-duration.policy";
import type { TerrainPosition, TerrainResult, TerrainSample, WalkingLeg } from "./terrain.types";

export const TERRAIN = {
	maxVertices: 10_000,
	sampleMeters: 100,
	maxSamples: 200,
	batchSize: 50,
	timeoutMs: 12_000,
	cacheSeconds: 604_800,
	cacheEntries: 250,
	noiseMeters: 3,
} as const;
const EARTH_RADIUS = 6_371_008.8;
const radians = (n: number) => (n * Math.PI) / 180;

export function terrainDistance(a: TerrainPosition, b: TerrainPosition): number {
	const h =
		Math.sin(radians(b[1] - a[1]) / 2) ** 2 +
		Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(radians(b[0] - a[0]) / 2) ** 2;
	return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function sampleTerrain(coordinates: TerrainPosition[]) {
	const cumulative = [0];
	for (let i = 1; i < coordinates.length; i++) {
		cumulative.push(cumulative[i - 1] + terrainDistance(coordinates[i - 1], coordinates[i]));
	}
	const distanceMeters = cumulative[cumulative.length - 1];
	const count = Math.min(
		TERRAIN.maxSamples,
		Math.max(2, Math.ceil(distanceMeters / TERRAIN.sampleMeters) + 1)
	);
	const sampleSpacingMeters = distanceMeters / (count - 1);
	let segment = 1;
	const samples = Array.from({ length: count }, (_, i) => {
		const distance = i === count - 1 ? distanceMeters : i * sampleSpacingMeters;
		while (segment < cumulative.length - 1 && cumulative[segment] < distance) segment++;
		const start = coordinates[segment - 1];
		const end = coordinates[segment];
		const length = cumulative[segment] - cumulative[segment - 1];
		const ratio = length > 0 ? (distance - cumulative[segment - 1]) / length : 0;
		// Interpolate along the short arc, including routes crossing the date line.
		const deltaLng = ((end[0] - start[0] + 540) % 360) - 180;
		const lng = ((start[0] + deltaLng * ratio + 540) % 360) - 180;
		return {
			coordinates: [lng, start[1] + (end[1] - start[1]) * ratio] as TerrainPosition,
			distanceMeters: distance,
		};
	});
	return { distanceMeters, sampleSpacingMeters, samples };
}

export function summarizeTerrain(
	profile: TerrainSample[],
	distanceMeters: number,
	sampleSpacingMeters: number,
	legs: WalkingLeg[] = [{ distanceMeters, terrain: "UNKNOWN" }]
): TerrainResult {
	let ascentMeters = 0;
	let descentMeters = 0;
	let anchor = profile[0].elevationMeters;
	let maxSlopePercent = 0;
	for (let i = 1; i < profile.length; i++) {
		const delta = profile[i].elevationMeters - profile[i - 1].elevationMeters;
		const run = profile[i].distanceMeters - profile[i - 1].distanceMeters;
		profile[i].slopePercent = run > 0 ? (delta / run) * 100 : 0;
		maxSlopePercent = Math.max(maxSlopePercent, Math.abs(profile[i].slopePercent));
		// Hysteresis suppresses small DEM fluctuations without losing a gradual climb.
		const change = profile[i].elevationMeters - anchor;
		if (Math.abs(change) >= TERRAIN.noiseMeters) {
			ascentMeters += Math.max(0, change);
			descentMeters += Math.max(0, -change);
			anchor = profile[i].elevationMeters;
		}
	}
	return {
		status: "READY",
		source: "MapTiler",
		distanceMeters,
		sampleSpacingMeters,
		ascentMeters,
		descentMeters,
		maxSlopePercent,
		...estimateRouteDuration(
			legs,
			ascentMeters,
			descentMeters,
			sampleSpacingMeters <= TERRAIN.sampleMeters
		),
		legs,
		profile,
	};
}
