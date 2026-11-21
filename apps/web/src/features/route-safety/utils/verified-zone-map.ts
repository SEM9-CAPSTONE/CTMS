import type { MapSafetyBounds, SafetyCollection } from "../types";

export function mapSafetyBounds(bounds: {
	minLongitude: number;
	minLatitude: number;
	maxLongitude: number;
	maxLatitude: number;
}): MapSafetyBounds {
	return {
		west: Math.max(-180, bounds.minLongitude - 0.001),
		south: Math.max(-90, bounds.minLatitude - 0.001),
		east: Math.min(180, bounds.maxLongitude + 0.001),
		north: Math.min(90, bounds.maxLatitude + 0.001),
	};
}

export function excludeSafetyFeatures(
	collection: SafetyCollection | undefined,
	hiddenIds: string[]
): SafetyCollection | undefined {
	if (!collection || hiddenIds.length === 0) return collection;
	const hidden = new Set(hiddenIds);
	return {
		...collection,
		features: collection.features.filter((feature) => !hidden.has(feature.id)),
	};
}

/** Project SVG user units into the surrounding HTML overlay, including letterboxing and pan/zoom. */
export function projectFallbackPosition(
	position: [number, number],
	viewBox: string,
	container: HTMLElement | null
): [number, number] {
	const rect = container?.getBoundingClientRect();
	if (!rect?.width || !rect.height) return position;
	const [x, y, width, height] = viewBox.split(" ").map(Number);
	const scale = Math.min(rect.width / width, rect.height / height);
	return [
		(((rect.width - width * scale) / 2 + (position[0] - x) * scale) / rect.width) * 100,
		(((rect.height - height * scale) / 2 + (position[1] - y) * scale) / rect.height) * 100,
	];
}
