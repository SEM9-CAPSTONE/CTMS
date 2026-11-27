import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TrekkingRouteDifficulty } from "../entities/trekking-route.entity";
import { CreateTrekkingRouteDto } from "./create-trekking-route.dto";

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: "  Pine Ridge Trail  ",
		description: "  Ridge route  ",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.441, 11.941],
				[108.449, 11.946],
			],
		},
		difficulty: TrekkingRouteDifficulty.MODERATE,
		expectedDurationMinutes: 120,
		...overrides,
	};
}

async function validationErrors(payload: Record<string, unknown>) {
	const dto = plainToInstance(CreateTrekkingRouteDto, payload);
	return {
		dto,
		errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
	};
}

describe("CreateTrekkingRouteDto", () => {
	it("accepts and trims the canonical create contract", async () => {
		const { dto, errors } = await validationErrors(validPayload());

		expect(errors).toEqual([]);
		expect(dto.name).toBe("Pine Ridge Trail");
		expect(dto.description).toBe("Ridge route");
	});

	it("accepts an optional drawing with ordered WGS84 control points", async () => {
		const drawing = {
			mode: "smart",
			waypoints: [
				[108.441, 11.941],
				[108.449, 11.946],
			],
		};
		const { dto, errors } = await validationErrors(validPayload({ drawing }));
		expect(errors).toEqual([]);
		expect(dto.drawing).toEqual(drawing);
	});

	it("accepts hybrid segment boundaries that cover exactly the persisted line", async () => {
		const waypoints = [
			[108, 16],
			[108.02, 16],
			[108.03, 16],
		];
		const geometry = {
			type: "LineString",
			coordinates: [waypoints[0], [108.01, 16.01], ...waypoints.slice(1)],
		};
		const segments = [
			{ id: "first", mode: "smart", endIndex: 2 },
			{ id: "second", mode: "manual", endIndex: 3 },
		];
		const { errors } = await validationErrors(
			validPayload({ geometry, drawing: { mode: "hybrid", waypoints, segments } })
		);
		expect(errors).toEqual([]);
		for (const invalid of [
			{ waypoints, segments: undefined },
			{ waypoints, segments: [{ ...segments[0], endIndex: 1 }, segments[1]] },
			{ waypoints, segments: [segments[0], { ...segments[1], id: "first" }] },
			{ waypoints, segments: [segments[0], { ...segments[1], mode: "hybrid" }] },
			{ waypoints: [waypoints[0], waypoints[1]], segments: [segments[0]] },
		]) {
			const result = await validationErrors(
				validPayload({ geometry, drawing: { mode: "hybrid", ...invalid } })
			);
			expect(result.errors.map((error) => error.property)).toContain("drawing");
		}
	});

	it.each([
		{ mode: "smart", waypoints: [[108.441, 11.941]] },
		{
			mode: "smart",
			waypoints: [
				[108.441, 11.941],
				[181, 11.946],
			],
		},
		{
			mode: "auto",
			waypoints: [
				[108.441, 11.941],
				[108.449, 11.946],
			],
		},
	])("rejects invalid optional drawing controls %#", async (drawing) => {
		const { errors } = await validationErrors(validPayload({ drawing }));
		expect(errors.some((error) => error.property === "drawing")).toBe(true);
	});

	it.each([
		{ type: "Point", coordinates: [108.441, 11.941] },
		{ type: "LineString", coordinates: [[108.441, 11.941]] },
		{
			type: "LineString",
			coordinates: [
				[181, 11.941],
				[108.449, 11.946],
			],
		},
		{
			type: "LineString",
			coordinates: [
				[108.441, Number.POSITIVE_INFINITY],
				[108.449, 11.946],
			],
		},
	])("rejects invalid LineString geometry %#", async (geometry) => {
		const { errors } = await validationErrors(validPayload({ geometry }));

		expect(errors.some((error) => error.property === "geometry")).toBe(true);
	});

	it("rejects unsupported difficulty and non-positive duration", async () => {
		const { errors } = await validationErrors(
			validPayload({ difficulty: "extreme", expectedDurationMinutes: 0 })
		);

		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["difficulty", "expectedDurationMinutes"])
		);
	});

	it("rejects authoritative fields supplied by a client", async () => {
		const { errors } = await validationErrors(
			validPayload({ hostId: "host", status: "active", lengthMeters: 1 })
		);

		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["hostId", "status", "lengthMeters"])
		);
	});
});
