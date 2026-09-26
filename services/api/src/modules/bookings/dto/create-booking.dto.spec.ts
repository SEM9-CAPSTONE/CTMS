import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateBookingDto } from "./create-booking.dto";

const TRIP_ID = "33333333-3333-4333-8333-333333333333";

describe("CreateBookingDto", () => {
	it.each([1, 3])("accepts numPeople=%s", async (numPeople) => {
		const dto = plainToInstance(CreateBookingDto, { tripId: TRIP_ID, numPeople });
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it.each([0, -1, 1.5])("rejects numPeople=%s", async (numPeople) => {
		const dto = plainToInstance(CreateBookingDto, { tripId: TRIP_ID, numPeople });
		expect(await validate(dto)).not.toHaveLength(0);
	});

	it("rejects an invalid Trip identifier", async () => {
		const dto = plainToInstance(CreateBookingDto, { tripId: "trip", numPeople: 1 });
		expect(await validate(dto)).not.toHaveLength(0);
	});
});
