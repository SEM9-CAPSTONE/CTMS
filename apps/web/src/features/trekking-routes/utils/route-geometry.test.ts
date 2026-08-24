import { describe, expect, it } from "vitest";
import {
	addVertex,
	emptyLineString,
	moveVertex,
	removeLastVertex,
	removeVertex,
} from "./route-geometry";

describe("route geometry vertex operations", () => {
	it("adds, moves, removes and clears vertices while preserving order", () => {
		const first = addVertex(emptyLineString(), [108.45, 11.94]);
		const second = addVertex(first, [108.46, 11.95]);
		expect(second.coordinates).toEqual([
			[108.45, 11.94],
			[108.46, 11.95],
		]);
		expect(moveVertex(second, 0, [108.44, 11.93]).coordinates).toEqual([
			[108.44, 11.93],
			[108.46, 11.95],
		]);
		expect(removeVertex(second, 0).coordinates).toEqual([[108.46, 11.95]]);
		expect(removeLastVertex(second).coordinates).toEqual([[108.45, 11.94]]);
		expect(emptyLineString().coordinates).toEqual([]);
	});
});
