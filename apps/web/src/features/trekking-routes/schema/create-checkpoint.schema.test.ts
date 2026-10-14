import { describe, expect, it } from "vitest";
import {
	checkpointDefaultValues,
	createCheckpointFormSchema,
	toCreateCheckpointInput,
} from "./create-checkpoint.schema";

const valid = {
	name: "  Ridge rest  ",
	location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	type: "rest" as const,
	expectedArrivalOffset: "45",
	instructions: "  Rest here  ",
};

describe("createCheckpointFormSchema", () => {
	it("accepts exact metadata and converts numeric strings", () => {
		const parsed = createCheckpointFormSchema.parse(valid);
		expect(toCreateCheckpointInput(parsed)).toEqual({
			...valid,
			name: "Ridge rest",
			radiusMeters: 20,
			expectedArrivalOffset: 45,
			instructions: "Rest here",
			nearbyWaterOrShelter: false,
		});
	});

	it.each([10, 30, 500])("cannot override the fixed radius with %s", (radiusMeters) => {
		const parsed = createCheckpointFormSchema.parse({ ...valid, radiusMeters });
		expect(parsed).not.toHaveProperty("radiusMeters");
		expect(toCreateCheckpointInput(parsed).radiusMeters).toBe(20);
	});

	it("accepts exact text maxima and rejects values above them", () => {
		expect(
			createCheckpointFormSchema.safeParse({
				...valid,
				name: "n".repeat(150),
				instructions: "i".repeat(1000),
			}).success
		).toBe(true);
		const tooLongName = createCheckpointFormSchema.safeParse({ ...valid, name: "n".repeat(151) });
		const tooLongInstructions = createCheckpointFormSchema.safeParse({
			...valid,
			instructions: "i".repeat(1001),
		});
		expect(tooLongName.success).toBe(false);
		expect(tooLongInstructions.success).toBe(false);
	});

	it.each([
		{ ...valid, name: " " },
		{ ...valid, expectedArrivalOffset: "-1" },
		{ ...valid, type: "viewpoint" },
		{ ...valid, instructions: " " },
		{ ...valid, location: { type: "Point", coordinates: [181, 0] } },
	])("rejects invalid checkpoint form values", (value) => {
		expect(createCheckpointFormSchema.safeParse(value).success).toBe(false);
	});

	it("keeps the compatibility flag out of form state while preserving it in API mapping", () => {
		const defaults = checkpointDefaultValues({ type: "Point", coordinates: [0, 0] });
		expect(defaults).toEqual(expect.objectContaining({ type: "rest" }));
		expect(defaults).not.toHaveProperty("nearbyWaterOrShelter");
		expect(toCreateCheckpointInput(defaults, true).nearbyWaterOrShelter).toBe(true);
	});
});
