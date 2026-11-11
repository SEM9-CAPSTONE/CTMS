import { z } from "zod";
import { EQUIPMENT_CATALOG_STATUSES } from "../types";
import type { UpdateEquipmentCatalogItemInput } from "../types";

export const updateEquipmentCatalogItemSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Tên thiết bị là bắt buộc")
		.max(150, "Tên thiết bị không được vượt quá 150 ký tự"),
	category: z
		.string()
		.trim()
		.min(1, "Loại thiết bị là bắt buộc")
		.max(100, "Loại thiết bị không được vượt quá 100 ký tự"),
	quantityTotal: z
		.number({ invalid_type_error: "Số lượng là bắt buộc" })
		.int("Số lượng phải là số nguyên")
		.min(0, "Số lượng không được âm"),
	rentalPricePerDay: z
		.number({ invalid_type_error: "Giá thuê mỗi ngày là bắt buộc" })
		.min(0, "Giá thuê không được âm"),
	status: z.enum(EQUIPMENT_CATALOG_STATUSES, { invalid_type_error: "Trạng thái chưa hợp lệ" }),
	maintenanceSchedule: z.string().trim().max(500, "Lịch bảo trì không được vượt quá 500 ký tự"),
});

export type UpdateEquipmentCatalogItemFormValues = z.infer<typeof updateEquipmentCatalogItemSchema>;

export function toUpdateEquipmentCatalogItemInput(
	values: UpdateEquipmentCatalogItemFormValues
): UpdateEquipmentCatalogItemInput {
	const maintenanceSchedule = values.maintenanceSchedule.trim();
	return {
		name: values.name.trim(),
		category: values.category.trim(),
		quantityTotal: values.quantityTotal,
		rentalPricePerDay: values.rentalPricePerDay,
		status: values.status,
		maintenanceSchedule: maintenanceSchedule || null,
	};
}
