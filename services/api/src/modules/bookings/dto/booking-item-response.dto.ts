import { ApiProperty } from "@nestjs/swagger";
import { BookingItemType } from "../booking-item-type.enum";

export class BookingItemResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ enum: BookingItemType })
	itemType!: BookingItemType;

	@ApiProperty({ format: "uuid" })
	equipmentCatalogItemId!: string;

	@ApiProperty({ minimum: 1 })
	quantity!: number;

	@ApiProperty({ type: String, example: "50000.00" })
	unitPrice!: string;

	@ApiProperty({ minimum: 1 })
	rentalDays!: number;

	@ApiProperty({ type: String, example: "150000.00" })
	totalPrice!: string;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;
}
