import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { CreateEquipmentCatalogItemDto } from "./create-equipment-catalog-item.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: CreateEquipmentCatalogItemDto });

describe("CreateEquipmentCatalogItemDto", () => {
	const valid = {
		name: "4-person tent",
		category: "shelter",
		quantityTotal: 10,
		rentalPricePerDay: 50000,
	};

	it("accepts a valid payload and trims name/category", async () => {
		await expect(
			validate({ ...valid, name: "  4-person tent  ", category: "  shelter  " })
		).resolves.toEqual(valid);
	});

	it("accepts an optional trimmed maintenanceSchedule", async () => {
		await expect(
			validate({ ...valid, maintenanceSchedule: "  Check zippers monthly  " })
		).resolves.toEqual({ ...valid, maintenanceSchedule: "Check zippers monthly" });
	});

	it("rejects a caller-supplied status (BR-175: no client self-assertion of state)", async () => {
		await expect(validate({ ...valid, status: "active" })).rejects.toMatchObject({ status: 422 });
	});

	it("rejects a caller-supplied hostId", async () => {
		await expect(validate({ ...valid, hostId: "override" })).rejects.toMatchObject({ status: 422 });
	});

	it.each(["name", "category", "quantityTotal", "rentalPricePerDay"])(
		"rejects a missing required field: %s",
		async (field) => {
			const payload: Record<string, unknown> = { ...valid };
			delete payload[field];
			await expect(validate(payload)).rejects.toMatchObject({ status: 422 });
		}
	);

	it.each(["", "   "])("rejects a blank name: %p", async (name) => {
		await expect(validate({ ...valid, name })).rejects.toMatchObject({ status: 422 });
	});

	it.each([-1, -0.01])(
		"rejects a negative quantityTotal or rentalPricePerDay: %p",
		async (value) => {
			await expect(validate({ ...valid, quantityTotal: value })).rejects.toMatchObject({
				status: 422,
			});
			await expect(validate({ ...valid, rentalPricePerDay: value })).rejects.toMatchObject({
				status: 422,
			});
		}
	);

	it("accepts a zero quantityTotal and a zero rentalPricePerDay (non-negative, not positive)", async () => {
		await expect(
			validate({ ...valid, quantityTotal: 0, rentalPricePerDay: 0 })
		).resolves.toMatchObject({ quantityTotal: 0, rentalPricePerDay: 0 });
	});

	it("rejects a non-integer quantityTotal", async () => {
		await expect(validate({ ...valid, quantityTotal: 1.5 })).rejects.toMatchObject({
			status: 422,
		});
	});
});
