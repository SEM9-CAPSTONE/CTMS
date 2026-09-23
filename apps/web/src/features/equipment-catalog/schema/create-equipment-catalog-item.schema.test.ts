import { describe, expect, it } from "vitest";
import {
	CREATE_EQUIPMENT_CATALOG_ITEM_DEFAULT_VALUES,
	createEquipmentCatalogItemSchema,
	toCreateEquipmentCatalogItemInput,
} from "./create-equipment-catalog-item.schema";

const valid = {
	name: "  4-person tent  ",
	category: "  shelter  ",
	quantityTotal: 10,
	rentalPricePerDay: 50000,
	maintenanceSchedule: "  Check zippers monthly  ",
};

describe("createEquipmentCatalogItemSchema", () => {
	it("accepts a valid payload and trims text fields", () => {
		const parsed = createEquipmentCatalogItemSchema.parse(valid);
		expect(toCreateEquipmentCatalogItemInput(parsed)).toEqual({
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
			maintenanceSchedule: "Check zippers monthly",
		});
	});

	it("omits an empty maintenanceSchedule from the mapped input", () => {
		const parsed = createEquipmentCatalogItemSchema.parse({ ...valid, maintenanceSchedule: "   " });
		expect(toCreateEquipmentCatalogItemInput(parsed)).toEqual({
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 10,
			rentalPricePerDay: 50000,
		});
	});

	it("accepts a zero quantityTotal and a zero rentalPricePerDay", () => {
		expect(
			createEquipmentCatalogItemSchema.safeParse({
				...valid,
				quantityTotal: 0,
				rentalPricePerDay: 0,
			}).success
		).toBe(true);
	});

	it.each([
		{ ...valid, name: "   " },
		{ ...valid, category: "   " },
		{ ...valid, name: "n".repeat(151) },
		{ ...valid, category: "c".repeat(101) },
		{ ...valid, quantityTotal: -1 },
		{ ...valid, quantityTotal: 1.5 },
		{ ...valid, rentalPricePerDay: -0.01 },
		{ ...valid, maintenanceSchedule: "m".repeat(501) },
	])("rejects invalid form values", (value) => {
		expect(createEquipmentCatalogItemSchema.safeParse(value).success).toBe(false);
	});

	it("uses safe initial values", () => {
		expect(CREATE_EQUIPMENT_CATALOG_ITEM_DEFAULT_VALUES).toEqual({
			name: "",
			category: "",
			quantityTotal: 0,
			rentalPricePerDay: 0,
			maintenanceSchedule: "",
		});
	});
});
