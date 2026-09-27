import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AddBookingItemDto } from "./add-booking-item.dto";

const EQUIPMENT_ID = "66666666-6666-4666-8666-666666666666";

describe("AddBookingItemDto", () => {
	it.each([1, 3])("accepts quantity=%s", async (quantity) => {
		const dto = plainToInstance(AddBookingItemDto, {
			equipmentCatalogItemId: EQUIPMENT_ID,
			quantity,
		});
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it.each([0, -1, 1.5])("rejects quantity=%s", async (quantity) => {
		const dto = plainToInstance(AddBookingItemDto, {
			equipmentCatalogItemId: EQUIPMENT_ID,
			quantity,
		});
		expect(await validate(dto)).not.toHaveLength(0);
	});

	it("rejects an invalid Equipment catalog item identifier", async () => {
		const dto = plainToInstance(AddBookingItemDto, {
			equipmentCatalogItemId: "not-a-uuid",
			quantity: 1,
		});
		expect(await validate(dto)).not.toHaveLength(0);
	});
});
