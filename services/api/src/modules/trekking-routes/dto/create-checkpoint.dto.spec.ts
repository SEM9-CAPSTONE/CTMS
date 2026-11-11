import { plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";
import { CheckpointType } from "../entities/checkpoint.entity";
import { CreateCheckpointDto, ROUTE_CHECKPOINT_TYPES } from "./create-checkpoint.dto";

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: "  Ridge rest  ",
		location: { type: "Point", coordinates: [108.458313, 11.940419] },
		radiusMeters: 20,
		type: CheckpointType.WATER,
		expectedArrivalOffset: 45,
		instructions: "  Rest and check water.  ",
		nearbyWaterOrShelter: true,
		...overrides,
	};
}

async function validationErrors(payload: Record<string, unknown>) {
	const dto = plainToInstance(CreateCheckpointDto, payload);
	return {
		dto,
		errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
	};
}

function allProperties(errors: ValidationError[]): string[] {
	return errors.flatMap((error) => [error.property, ...allProperties(error.children ?? [])]);
}

describe("CreateCheckpointDto", () => {
	it("accepts the approved contract and trims name and instructions", async () => {
		const { dto, errors } = await validationErrors(validPayload());
		expect(errors).toEqual([]);
		expect(dto.name).toBe("Ridge rest");
		expect(dto.instructions).toBe("Rest and check water.");
	});

	it.each([
		{
			name: "minimum spatial and numeric boundaries",
			payload: {
				name: "n".repeat(150),
				location: { type: "Point", coordinates: [-180, -90] },
				radiusMeters: 20,
				expectedArrivalOffset: 0,
				instructions: "i".repeat(1000),
			},
		},
		{
			name: "maximum spatial and radius boundaries",
			payload: {
				location: { type: "Point", coordinates: [180, 90] },
				radiusMeters: 20,
			},
		},
	])("accepts $name", async ({ payload }) => {
		expect((await validationErrors(validPayload(payload))).errors).toEqual([]);
	});

	it.each([
		["missing", undefined],
		["blank", "   "],
		["too long", "n".repeat(151)],
	])("rejects %s name", async (_label, name) => {
		const { name: _currentName, ...withoutName } = validPayload();
		const payload = name === undefined ? withoutName : { ...withoutName, name };
		expect(allProperties((await validationErrors(payload)).errors)).toContain("name");
	});

	it("rejects an explicitly undefined location without omitting the property", async () => {
		const payload = validPayload({ location: undefined });
		expect(Object.hasOwn(payload, "location")).toBe(true);
		expect(allProperties((await validationErrors(payload)).errors)).toContain("location");
	});

	it.each([
		undefined,
		null,
		{},
		{ type: "LineString", coordinates: [108.45, 11.94] },
		{ type: "Point", coordinates: [108.45] },
		{ type: "Point", coordinates: [108.45, 11.94, 1] },
		{ type: "Point", coordinates: [181, 11.94] },
		{ type: "Point", coordinates: [108.45, -91] },
		{ type: "Point", coordinates: [Number.POSITIVE_INFINITY, 11.94] },
	])("rejects missing or invalid Point %#", async (location) => {
		const payload =
			location === undefined
				? (() => {
						const { location: _location, ...withoutLocation } = validPayload();
						return withoutLocation;
					})()
				: validPayload({ location });
		const properties = allProperties((await validationErrors(payload)).errors);
		expect(properties).toEqual(expect.arrayContaining(["location"]));
	});

	it.each([9, 10, 30, 500, 501, 10.5])("rejects invalid radius %s", async (radiusMeters) => {
		expect(
			allProperties((await validationErrors(validPayload({ radiusMeters }))).errors)
		).toContain("radiusMeters");
	});

	it("accepts all approved checkpoint types", async () => {
		for (const type of ROUTE_CHECKPOINT_TYPES) {
			expect((await validationErrors(validPayload({ type }))).errors).toEqual([]);
		}
		for (const type of ["waypoint", "invalid", 123]) {
			expect(allProperties((await validationErrors(validPayload({ type }))).errors)).toContain(
				"type"
			);
		}
	});

	it.each([-1, 1.5])("rejects invalid expected arrival offset %s", async (value) => {
		expect(
			allProperties((await validationErrors(validPayload({ expectedArrivalOffset: value }))).errors)
		).toContain("expectedArrivalOffset");
	});

	it("rejects instructions longer than 1000 characters", async () => {
		expect(
			allProperties(
				(await validationErrors(validPayload({ instructions: "i".repeat(1001) }))).errors
			)
		).toContain("instructions");
	});

	it.each([
		["missing", undefined],
		["blank", "   "],
		["null", null],
	])("accepts %s instructions as an empty string", async (_label, instructions) => {
		const { instructions: _current, ...withoutInstructions } = validPayload();
		const payload =
			instructions === undefined ? withoutInstructions : { ...withoutInstructions, instructions };
		const { dto, errors } = await validationErrors(payload);
		expect(errors).toEqual([]);
		expect(dto.instructions).toBe("");
	});

	it("requires nearbyWaterOrShelter to be a boolean", async () => {
		const { nearbyWaterOrShelter: _nearby, ...missing } = validPayload();
		expect(allProperties((await validationErrors(missing)).errors)).toContain(
			"nearbyWaterOrShelter"
		);
		expect(
			allProperties((await validationErrors(validPayload({ nearbyWaterOrShelter: "true" }))).errors)
		).toContain("nearbyWaterOrShelter");
	});

	it("rejects server-controlled and unexpected properties", async () => {
		const { errors } = await validationErrors(
			validPayload({
				id: "checkpoint-id",
				routeId: "route-id",
				hostId: "host-id",
				unexpectedField: "unexpected",
				routePosition: 0.5,
				createdAt: "now",
				updatedAt: "now",
			})
		);
		expect(allProperties(errors)).toEqual(
			expect.arrayContaining([
				"id",
				"routeId",
				"hostId",
				"unexpectedField",
				"routePosition",
				"createdAt",
				"updatedAt",
			])
		);
	});
});
