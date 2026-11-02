import type { TerrainPosition } from "./terrain.types";
import { classifyWalkingWay, matchWalkingLegs } from "./walking-terrain.policy";

describe("Walking terrain metadata", () => {
	it.each([
		[{ highway: "footway", surface: "asphalt", smoothness: "good" }, "EASY"],
		[{ highway: "path", surface: "ground", smoothness: "intermediate" }, "MODERATE"],
		[{ highway: "path", surface: "rock", smoothness: "bad" }, "HARD"],
		[{ highway: "path", surface: "unpaved" }, "UNKNOWN"],
		[{ highway: "footway", surface: "asphalt" }, "UNKNOWN"],
		[{ highway: "path", surface: "rock", smoothness: "good" }, "UNKNOWN"],
		[{ highway: "footway", surface: "asphalt", smoothness: "good", foot: "no" }, "UNKNOWN"],
	])("classifies explicit tags without using route difficulty: %j", (tags, expected) => {
		expect(classifyWalkingWay(tags)).toBe(expected);
	});
	const samples = [
		{ coordinates: [108, 12] as TerrainPosition, distanceMeters: 0 },
		{ coordinates: [108.001, 12] as TerrainPosition, distanceMeters: 109 },
		{ coordinates: [108.002, 12] as TerrainPosition, distanceMeters: 218 },
	];
	it("matches and merges only legs aligned with a mapped way", () => {
		expect(
			matchWalkingLegs(samples, [
				{ coordinates: samples.map((p) => p.coordinates), terrain: "MODERATE" },
			])
		).toEqual([{ distanceMeters: 218, terrain: "MODERATE" }]);
	});
	it("leaves uncovered and ambiguous legs unknown", () => {
		expect(matchWalkingLegs(samples, [])).toEqual([{ distanceMeters: 218, terrain: "UNKNOWN" }]);
		const coordinates = samples.map((p) => p.coordinates);
		expect(
			matchWalkingLegs(samples, [
				{ coordinates, terrain: "EASY" },
				{ coordinates, terrain: "HARD" },
			])
		).toEqual([{ distanceMeters: 218, terrain: "UNKNOWN" }]);
	});
	it("does not classify a straight shortcut by a curved mapped way with matching endpoints", () => {
		expect(
			matchWalkingLegs(
				[samples[0], samples[2]],
				[
					{
						coordinates: [samples[0].coordinates, [108.001, 12.01], samples[2].coordinates],
						terrain: "EASY",
					},
				]
			)
		).toEqual([{ distanceMeters: 218, terrain: "UNKNOWN" }]);
	});
});
