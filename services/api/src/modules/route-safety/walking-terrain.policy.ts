import type { TerrainPosition, WalkingLeg, WalkingTerrain } from "./terrain.types";

export const WALKING_MAP = {
	maxEnvelopeDegrees: 0.3,
	maxWays: 2000,
	maxNodesPerWay: 5000,
	maxTotalNodes: 20_000,
	matchMeters: 20,
	timeoutMs: 5000,
	metersPerDegree: 111_195,
	highways: ["footway", "pedestrian", "path", "track", "bridleway"],
	firmPaved: ["asphalt", "concrete", "paving_stones"],
	firmUnpaved: ["compacted", "fine_gravel", "ground", "dirt", "earth", "grass"],
	roughSurface: ["rock", "stone", "scree", "sand", "mud"],
	even: ["excellent", "good", "intermediate"],
	uneven: ["bad", "very_bad", "horrible", "very_horrible"],
};

export interface WalkingWay {
	coordinates: TerrainPosition[];
	terrain: WalkingTerrain;
}

/** Conservative CTMS estimates from explicit tags, not official terrain certification.
 * Neither generic paved/unpaved nor Route.difficulty establishes a walking speed. */
export function classifyWalkingWay(tags: Record<string, unknown>): WalkingTerrain {
	const highway = String(tags.highway ?? "");
	const surface = String(tags.surface ?? "");
	const smoothness = String(tags.smoothness ?? "");
	if (
		!WALKING_MAP.highways.includes(highway) ||
		tags.foot === "no" ||
		tags.access === "no" ||
		tags.access === "private"
	)
		return "UNKNOWN";
	if (WALKING_MAP.roughSurface.includes(surface) && WALKING_MAP.uneven.includes(smoothness))
		return "HARD";
	if (!WALKING_MAP.even.includes(smoothness)) return "UNKNOWN";
	if (["footway", "pedestrian"].includes(highway) && WALKING_MAP.firmPaved.includes(surface))
		return "EASY";
	if (WALKING_MAP.firmUnpaved.includes(surface)) return "MODERATE";
	return "UNKNOWN";
}

function distanceToWay(point: TerrainPosition, coordinates: TerrainPosition[]): number {
	const xScale = WALKING_MAP.metersPerDegree * Math.cos((point[1] * Math.PI) / 180);
	let nearest = Number.POSITIVE_INFINITY;
	for (let i = 1; i < coordinates.length; i++) {
		const a = coordinates[i - 1];
		const b = coordinates[i];
		const ax = (a[0] - point[0]) * xScale;
		const ay = (a[1] - point[1]) * WALKING_MAP.metersPerDegree;
		const dx = (b[0] - a[0]) * xScale;
		const dy = (b[1] - a[1]) * WALKING_MAP.metersPerDegree;
		const squared = dx * dx + dy * dy;
		const ratio = squared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squared)) : 0;
		nearest = Math.min(nearest, Math.hypot(ax + ratio * dx, ay + ratio * dy));
	}
	return nearest;
}

export function matchWalkingLegs(
	samples: { coordinates: TerrainPosition; distanceMeters: number }[],
	ways: WalkingWay[]
): WalkingLeg[] {
	const boundedWays = ways.map((way) => ({
		...way,
		west: Math.min(...way.coordinates.map((p) => p[0])),
		east: Math.max(...way.coordinates.map((p) => p[0])),
		south: Math.min(...way.coordinates.map((p) => p[1])),
		north: Math.max(...way.coordinates.map((p) => p[1])),
	}));
	const legs: WalkingLeg[] = [];
	for (let i = 1; i < samples.length; i++) {
		const start = samples[i - 1];
		const end = samples[i];
		const middle: TerrainPosition = [
			(start.coordinates[0] + end.coordinates[0]) / 2,
			(start.coordinates[1] + end.coordinates[1]) / 2,
		];
		const dy = WALKING_MAP.matchMeters / WALKING_MAP.metersPerDegree;
		const dx = dy / Math.max(0.01, Math.cos((middle[1] * Math.PI) / 180));
		const candidates = boundedWays.filter(
			(way) =>
				middle[0] >= way.west - dx &&
				middle[0] <= way.east + dx &&
				middle[1] >= way.south - dy &&
				middle[1] <= way.north + dy &&
				[start.coordinates, middle, end.coordinates].every(
					(p) => distanceToWay(p, way.coordinates) <= WALKING_MAP.matchMeters
				)
		);
		const categories = new Set(candidates.map((way) => way.terrain));
		// Parallel/crossing ways with conflicting metadata must remain unclassified.
		const terrain = categories.size === 1 ? candidates[0].terrain : "UNKNOWN";
		const distanceMeters = end.distanceMeters - start.distanceMeters;
		const previous = legs.at(-1);
		if (previous?.terrain === terrain) previous.distanceMeters += distanceMeters;
		else legs.push({ terrain, distanceMeters });
	}
	return legs;
}
