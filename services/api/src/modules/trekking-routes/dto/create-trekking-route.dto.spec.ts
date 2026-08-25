import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TrekkingRouteDifficulty } from "../entities/trekking-route.entity";
import { CreateTrekkingRouteDto } from "./create-trekking-route.dto";

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		campsiteId: "11111111-1111-4111-8111-111111111111",
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

	it("rejects authoritative and ownership fields supplied by a client", async () => {
		const { errors } = await validationErrors(
			validPayload({ hostId: "host", status: "active", lengthMeters: 1 })
		);

		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["hostId", "status", "lengthMeters"])
		);
	});
});
