import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTripDto, CreateTripWaypointDto } from "./create-trip.dto";

async function priceErrors(pricePerPerson: number) {
	const errors = await validate(plainToInstance(CreateTripDto, { pricePerPerson }));
	return errors.filter((error) => error.property === "pricePerPerson");
}
describe("CreateTripDto whole VND prices", () => {
	it.each([0, 150000])("accepts %s VND", async (price) => {
		expect(await priceErrors(price)).toHaveLength(0);
	});
	it.each([150000.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects invalid price %s",
		async (price) => {
			expect(await priceErrors(price)).not.toHaveLength(0);
		}
	);
});

describe("optional waypoint descriptions", () => {
	it("accepts an empty description without inventing a name", async () => {
		const dto = plainToInstance(CreateTripWaypointDto, {
			type: "meal",
			name: "   ",
			location: { type: "Point", coordinates: [108.24, 16.05] },
			plannedAt: "2099-10-01T05:00:00.000Z",
		});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.name).toBe("");
	});
});
