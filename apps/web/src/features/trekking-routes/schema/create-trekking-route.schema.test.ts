import { describe, expect, it } from "vitest";
import {
	createTrekkingRouteFormSchema,
	toCreateTrekkingRouteInput,
} from "./create-trekking-route.schema";

const values = {
	campsiteId: "11111111-1111-4111-8111-111111111111",
	name: "  Ridge route  ",
	description: "  Scenic  ",
	difficulty: "hard" as const,
	expectedDurationMinutes: "120",
	geometry: {
		type: "LineString" as const,
		coordinates: [
			[108.45, 11.94],
			[108.46, 11.95],
		] as [number, number][],
	},
};

describe("createTrekkingRouteFormSchema", () => {
	it("validates metadata and produces the exact API payload", () => {
		const parsed = createTrekkingRouteFormSchema.parse(values);
		expect(toCreateTrekkingRouteInput(parsed)).toEqual({
			campsiteId: values.campsiteId,
			name: "Ridge route",
			description: "Scenic",
			difficulty: "hard",
			expectedDurationMinutes: 120,
			geometry: values.geometry,
		});
	});

	it("rejects missing metadata, invalid duration and invalid geometry", () => {
		expect(
			createTrekkingRouteFormSchema.safeParse({
				...values,
				name: " ",
				expectedDurationMinutes: "0",
				geometry: { type: "LineString", coordinates: [[200, 10]] },
			}).success
		).toBe(false);
	});
});
