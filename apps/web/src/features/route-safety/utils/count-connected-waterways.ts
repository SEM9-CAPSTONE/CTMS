import type { SafetyFeature } from "../types";

export function countConnectedWaterways(water: SafetyFeature[]): number {
	const parent: number[] = [];
	const segmentAtCoordinate = new Map<string, number>();
	let count = 0;

	const root = (segment: number): number => {
		let current = segment;

		while (parent[current] !== current) {
			parent[current] = parent[parent[current]];
			current = parent[current];
		}

		return current;
	};

	for (const { geometry } of water) {
		if (geometry.type !== "LineString") continue;
		const segment = parent.length;
		parent.push(segment);
		count++;
		for (const coordinate of geometry.coordinates) {
			const key = coordinate.join(",");
			const other = segmentAtCoordinate.get(key);
			if (other === undefined) {
				segmentAtCoordinate.set(key, segment);
				continue;
			}
			const otherRoot = root(other);
			const currentRoot = root(segment);
			if (otherRoot !== currentRoot) {
				parent[otherRoot] = currentRoot;
				count--;
			}
		}
	}
	return count;
}
