import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { EquipmentCatalogStatus } from "../equipment-catalog-status.enum";
import { UpdateEquipmentCatalogItemDto } from "./update-equipment-catalog-item.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: UpdateEquipmentCatalogItemDto });

describe("UpdateEquipmentCatalogItemDto", () => {
	it("accepts an empty patch", async () => {
		await expect(validate({})).resolves.toEqual({});
	});

	it("accepts a partial patch with only one field", async () => {
		await expect(validate({ quantityTotal: 3 })).resolves.toEqual({ quantityTotal: 3 });
	});

	it("accepts every valid status value", async () => {
		for (const status of Object.values(EquipmentCatalogStatus)) {
			await expect(validate({ status })).resolves.toEqual({ status });
		}
	});

	it("rejects an invalid status value", async () => {
		await expect(validate({ status: "unknown" })).rejects.toMatchObject({ status: 422 });
	});

	it("rejects a negative quantityTotal or rentalPricePerDay", async () => {
		await expect(validate({ quantityTotal: -1 })).rejects.toMatchObject({ status: 422 });
		await expect(validate({ rentalPricePerDay: -0.01 })).rejects.toMatchObject({ status: 422 });
	});

	it("allows clearing maintenanceSchedule to null", async () => {
		await expect(validate({ maintenanceSchedule: null })).resolves.toEqual({
			maintenanceSchedule: null,
		});
	});

	it("trims a non-null maintenanceSchedule", async () => {
		await expect(validate({ maintenanceSchedule: "  Every 3 months  " })).resolves.toEqual({
			maintenanceSchedule: "Every 3 months",
		});
	});

	it("rejects a blank (whitespace-only) name or category when provided", async () => {
		await expect(validate({ name: "   " })).rejects.toMatchObject({ status: 422 });
		await expect(validate({ category: "   " })).rejects.toMatchObject({ status: 422 });
	});

	it("rejects a caller-supplied hostId", async () => {
		await expect(validate({ hostId: "override" })).rejects.toMatchObject({ status: 422 });
	});
});
