import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsUUID, Min } from "class-validator";

export class AddBookingItemDto {
	@ApiProperty({ format: "uuid", description: "Equipment catalog item to rent for this Booking" })
	@IsUUID()
	equipmentCatalogItemId!: string;

	@ApiProperty({ minimum: 1, description: "Number of units to reserve" })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}
