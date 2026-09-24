export const EQUIPMENT_CATALOG_STATUSES = ["active", "inactive", "retired"] as const;
export type EquipmentCatalogStatus = (typeof EQUIPMENT_CATALOG_STATUSES)[number];

export interface EquipmentCatalogItem {
	id: string;
	hostId: string;
	name: string;
	category: string;
	quantityTotal: number;
	rentalPricePerDay: number;
	status: EquipmentCatalogStatus;
	maintenanceSchedule: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateEquipmentCatalogItemInput {
	name: string;
	category: string;
	quantityTotal: number;
	rentalPricePerDay: number;
	maintenanceSchedule?: string;
}

export interface UpdateEquipmentCatalogItemInput {
	name?: string;
	category?: string;
	quantityTotal?: number;
	rentalPricePerDay?: number;
	status?: EquipmentCatalogStatus;
	maintenanceSchedule?: string | null;
}
