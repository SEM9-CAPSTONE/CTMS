import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CheckpointType } from "../entities/checkpoint.entity";
import { UpdateCheckpointDto } from "./update-checkpoint.dto";

describe("UpdateCheckpointDto", () => {
	it("inherits the complete validated checkpoint edit contract", async () => {
		const dto = plainToInstance(UpdateCheckpointDto, {
			name: "  Water point  ",
			location: { type: "Point", coordinates: [108.458313, 11.940419] },
			radiusMeters: 40,
			type: CheckpointType.WATER,
			expectedArrivalOffset: 50,
			instructions: "  Refill water.  ",
			nearbyWaterOrShelter: true,
		});

		expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
		expect(dto.name).toBe("Water point");
		expect(dto.instructions).toBe("Refill water.");
	});

	it("rejects invalid and server-controlled update fields", async () => {
		const dto = plainToInstance(UpdateCheckpointDto, {
			name: "",
			location: { type: "LineString", coordinates: [] },
			radiusMeters: 9,
			type: "waypoint",
			expectedArrivalOffset: -1,
			instructions: "",
			nearbyWaterOrShelter: "true",
			routePosition: 0.5,
		});
		const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining([
				"name",
				"location",
				"radiusMeters",
				"type",
				"expectedArrivalOffset",
				"instructions",
				"nearbyWaterOrShelter",
				"routePosition",
			])
		);
	});
});
