import { describe, expect, it } from "vitest";
import {
	toUpdateEquipmentCatalogItemInput,
	updateEquipmentCatalogItemSchema,
} from "./update-equipment-catalog-item.schema";

const valid = {
	name: "  4-person tent  ",
	category: "  shelter  ",
	quantityTotal: 5,
	rentalPricePerDay: 60000,
	status: "inactive" as const,
	maintenanceSchedule: "  Every 3 months  ",
};

describe("updateEquipmentCatalogItemSchema", () => {
	it("accepts a valid payload and trims text fields", () => {
		const parsed = updateEquipmentCatalogItemSchema.parse(valid);
		expect(toUpdateEquipmentCatalogItemInput(parsed)).toEqual({
			name: "4-person tent",
			category: "shelter",
			quantityTotal: 5,
			rentalPricePerDay: 60000,
			status: "inactive",
			maintenanceSchedule: "Every 3 months",
		});
	});

	it("maps an empty maintenanceSchedule to null (clears it)", () => {
		const parsed = updateEquipmentCatalogItemSchema.parse({ ...valid, maintenanceSchedule: "   " });
		expect(toUpdateEquipmentCatalogItemInput(parsed).maintenanceSchedule).toBeNull();
	});

	it.each(["active", "inactive", "retired"] as const)("accepts status %s", (status) => {
		expect(updateEquipmentCatalogItemSchema.safeParse({ ...valid, status }).success).toBe(true);
	});

	it.each([
		{ ...valid, name: "   " },
		{ ...valid, category: "   " },
		{ ...valid, quantityTotal: -1 },
		{ ...valid, rentalPricePerDay: -0.01 },
		{ ...valid, status: "unknown" },
	])("rejects invalid form values", (value) => {
		expect(updateEquipmentCatalogItemSchema.safeParse(value).success).toBe(false);
	});
});
