import { describe, expect, it } from "vitest";
import {
	coordinateToPercent,
	geodesicCircle,
	percentToCoordinate,
	routeBounds,
} from "./checkpoint-map";

function haversineMeters(first: [number, number], second: [number, number]): number {
	const radians = (value: number) => (value * Math.PI) / 180;
	const latitudeDistance = radians(second[1] - first[1]);
	const longitudeDistance = radians(second[0] - first[0]);
	const value =
		Math.sin(latitudeDistance / 2) ** 2 +
		Math.cos(radians(first[1])) *
			Math.cos(radians(second[1])) *
			Math.sin(longitudeDistance / 2) ** 2;
	return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

describe("checkpoint map geometry", () => {
	it("round-trips fallback pointer coordinates", () => {
		const bounds = routeBounds([
			[108.45, 11.94],
			[108.47, 11.95],
		]);
		const coordinate: [number, number] = [108.46, 11.945];
		expect(percentToCoordinate(coordinateToPercent(coordinate, bounds), bounds)).toEqual(
			expect.arrayContaining([expect.closeTo(coordinate[0], 10), expect.closeTo(coordinate[1], 10)])
		);
	});

	it("builds a closed geodesic meter-radius polygon without a pixel approximation", () => {
		const center = { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] };
		const circle = geodesicCircle(center, 30, 32);
		expect(circle.geometry.coordinates[0]).toHaveLength(33);
		expect(circle.geometry.coordinates[0][0]).toEqual(circle.geometry.coordinates[0].at(-1));
		for (const point of circle.geometry.coordinates[0].slice(0, -1)) {
			expect(haversineMeters(center.coordinates, point)).toBeCloseTo(30, 5);
		}
	});
});
