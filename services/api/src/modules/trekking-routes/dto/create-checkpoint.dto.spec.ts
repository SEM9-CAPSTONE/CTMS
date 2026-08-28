import { plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";
import { CheckpointType } from "../entities/checkpoint.entity";
import { CreateCheckpointDto } from "./create-checkpoint.dto";

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: "  Ridge rest  ",
		location: { type: "Point", coordinates: [108.458313, 11.940419] },
		radiusMeters: 30,
		type: CheckpointType.REST,
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
				radiusMeters: 10,
				expectedArrivalOffset: 0,
				instructions: "i".repeat(1000),
			},
		},
		{
			name: "maximum spatial and radius boundaries",
			payload: {
				location: { type: "Point", coordinates: [180, 90] },
				radiusMeters: 500,
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

	it.each([9, 501, 10.5])("rejects invalid radius %s", async (radiusMeters) => {
		expect(
			allProperties((await validationErrors(validPayload({ radiusMeters }))).errors)
		).toContain("radiusMeters");
	});

	it("accepts exactly the six approved checkpoint types", async () => {
		for (const type of Object.values(CheckpointType)) {
			expect((await validationErrors(validPayload({ type }))).errors).toEqual([]);
		}
		expect(
			allProperties((await validationErrors(validPayload({ type: "waypoint" }))).errors)
		).toContain("type");
	});

	it.each([-1, 1.5])("rejects invalid expected arrival offset %s", async (value) => {
		expect(
			allProperties((await validationErrors(validPayload({ expectedArrivalOffset: value }))).errors)
		).toContain("expectedArrivalOffset");
	});

	it.each(["   ", "i".repeat(1001)])("rejects invalid instructions", async (instructions) => {
		expect(
			allProperties((await validationErrors(validPayload({ instructions }))).errors)
		).toContain("instructions");
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
				campsiteId: "campsite-id",
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
				"campsiteId",
				"routePosition",
				"createdAt",
				"updatedAt",
			])
		);
	});
});
