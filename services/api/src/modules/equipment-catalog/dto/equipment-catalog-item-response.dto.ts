import { ApiProperty } from "@nestjs/swagger";
import type { EquipmentCatalogItem } from "../entities/equipment-catalog-item.entity";
import { EquipmentCatalogStatus } from "../equipment-catalog-status.enum";

export class EquipmentCatalogItemResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	hostId!: string;

	@ApiProperty({ maxLength: 150 })
	name!: string;

	@ApiProperty({ maxLength: 100 })
	category!: string;

	@ApiProperty({ minimum: 0 })
	quantityTotal!: number;

	@ApiProperty({ minimum: 0 })
	rentalPricePerDay!: number;

	@ApiProperty({ enum: EquipmentCatalogStatus })
	status!: EquipmentCatalogStatus;

	@ApiProperty({ type: String, nullable: true })
	maintenanceSchedule!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}

export function toEquipmentCatalogItemResponse(
	item: EquipmentCatalogItem
): EquipmentCatalogItemResponseDto {
	return {
		id: item.id,
		hostId: item.hostId,
		name: item.name,
		category: item.category,
		quantityTotal: item.quantityTotal,
		rentalPricePerDay: item.rentalPricePerDay,
		status: item.status,
		maintenanceSchedule: item.maintenanceSchedule,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
}
