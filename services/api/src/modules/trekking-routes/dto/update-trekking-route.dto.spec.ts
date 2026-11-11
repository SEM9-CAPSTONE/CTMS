import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateTrekkingRouteDto } from "./update-trekking-route.dto";

const payload = {
	name: "Ridge",
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.1, 16.1],
		],
	},
	difficulty: "moderate",
	expectedDurationMinutes: 60,
};
describe("UpdateTrekkingRouteDto", () => {
	it("accepts complete editable data", async () => {
		expect(await validate(plainToInstance(UpdateTrekkingRouteDto, payload))).toEqual([]);
	});
	it.each([0, -1, 1.5])("rejects duration %s", async (expectedDurationMinutes) => {
		const errors = await validate(
			plainToInstance(UpdateTrekkingRouteDto, { ...payload, expectedDurationMinutes })
		);
		expect(errors.map((error) => error.property)).toContain("expectedDurationMinutes");
	});
	it("requires geometry and rejects server-owned fields", async () => {
		const errors = await validate(
			plainToInstance(UpdateTrekkingRouteDto, {
				...payload,
				geometry: undefined,
				hostId: "other-host",
				status: "active",
				lengthMeters: 1,
			}),
			{ whitelist: true, forbidNonWhitelisted: true }
		);
		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["geometry", "hostId", "status", "lengthMeters"])
		);
	});
});
