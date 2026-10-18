import { describe, expect, it } from "vitest";
import {
	checkpointDefaultValues,
	createCheckpointFormSchema,
	toCreateCheckpointInput,
} from "./create-checkpoint.schema";

const valid = {
	location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	type: "water",
	instructions: "  Refill here  ",
};

describe("createCheckpointFormSchema", () => {
	it("maps form values to the API input with a type-derived name", () => {
		const parsed = createCheckpointFormSchema.parse(valid);
		expect(toCreateCheckpointInput(parsed)).toEqual({
			name: "Điểm cấp nước",
			location: valid.location,
			radiusMeters: 20,
			type: "water",
			expectedArrivalOffset: 0,
			instructions: "Refill here",
			nearbyWaterOrShelter: false,
		});
	});

	it.each([10, 30, 500])("cannot override the fixed radius with %s", (radiusMeters) => {
		const parsed = createCheckpointFormSchema.parse({ ...valid, radiusMeters });
		expect(parsed).not.toHaveProperty("radiusMeters");
		expect(toCreateCheckpointInput(parsed).radiusMeters).toBe(20);
	});

	it("treats guidance as optional but caps it at 1000 characters", () => {
		expect(createCheckpointFormSchema.safeParse({ ...valid, instructions: " " }).success).toBe(
			true
		);
		expect(
			createCheckpointFormSchema.safeParse({ ...valid, instructions: "i".repeat(1000) }).success
		).toBe(true);
		expect(
			createCheckpointFormSchema.safeParse({ ...valid, instructions: "i".repeat(1001) }).success
		).toBe(false);
	});

	it.each([
		{ ...valid, type: "start" },
		{ ...valid, type: "rest" },
		{ ...valid, type: "finish" },
		{ ...valid, type: "" },
		{ ...valid, location: { type: "Point", coordinates: [181, 0] } },
	])("rejects invalid checkpoint form values %#", (value) => {
		expect(createCheckpointFormSchema.safeParse(value).success).toBe(false);
	});

	it("keeps stored arrival offset and compatibility flag when editing", () => {
		const defaults = checkpointDefaultValues({ type: "Point", coordinates: [0, 0] });
		expect(defaults).toEqual(expect.objectContaining({ type: "water", instructions: "" }));
		expect(defaults).not.toHaveProperty("nearbyWaterOrShelter");
		expect(
			toCreateCheckpointInput(defaults, { expectedArrivalOffset: 40, nearbyWaterOrShelter: true })
		).toEqual(expect.objectContaining({ expectedArrivalOffset: 40, nearbyWaterOrShelter: true }));
	});
});
