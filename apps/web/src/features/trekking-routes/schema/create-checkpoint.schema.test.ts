import { describe, expect, it } from "vitest";
import {
	checkpointDefaultValues,
	createCheckpointFormSchema,
	toCreateCheckpointInput,
} from "./create-checkpoint.schema";

const valid = {
	name: "  Ridge rest  ",
	location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	radiusMeters: "30",
	type: "rest" as const,
	expectedArrivalOffset: "45",
	instructions: "  Rest here  ",
	nearbyWaterOrShelter: true,
};

describe("createCheckpointFormSchema", () => {
	it("accepts exact metadata and converts numeric strings", () => {
		const parsed = createCheckpointFormSchema.parse(valid);
		expect(toCreateCheckpointInput(parsed)).toEqual({
			...valid,
			name: "Ridge rest",
			radiusMeters: 30,
			expectedArrivalOffset: 45,
			instructions: "Rest here",
		});
	});

	it.each([
		{ ...valid, name: " " },
		{ ...valid, radiusMeters: "9" },
		{ ...valid, radiusMeters: "501" },
		{ ...valid, radiusMeters: "10.5" },
		{ ...valid, expectedArrivalOffset: "-1" },
		{ ...valid, type: "viewpoint" },
		{ ...valid, instructions: " " },
		{ ...valid, location: { type: "Point", coordinates: [181, 0] } },
	])("rejects invalid checkpoint form values", (value) => {
		expect(createCheckpointFormSchema.safeParse(value).success).toBe(false);
	});

	it("uses safe initial values without preselecting a real route location", () => {
		expect(checkpointDefaultValues({ type: "Point", coordinates: [0, 0] })).toEqual(
			expect.objectContaining({ radiusMeters: "30", type: "rest", nearbyWaterOrShelter: false })
		);
	});
});
