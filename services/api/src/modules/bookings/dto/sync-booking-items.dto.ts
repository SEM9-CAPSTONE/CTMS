import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from "class-validator";

export class SyncBookingItemEntryDto {
	@ApiProperty({ format: "uuid", description: "Equipment catalog item to rent for this Booking" })
	@IsUUID()
	equipmentCatalogItemId!: string;

	@ApiProperty({ minimum: 1, description: "Number of units to reserve" })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class SyncBookingItemsDto {
	@ApiProperty({
		type: [SyncBookingItemEntryDto],
		description: "Complete list of equipment rental items for this Booking",
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncBookingItemEntryDto)
	items!: SyncBookingItemEntryDto[];
}
