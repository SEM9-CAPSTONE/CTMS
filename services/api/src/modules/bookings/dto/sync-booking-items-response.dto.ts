import { ApiProperty } from "@nestjs/swagger";
import { BookingItemResponseDto } from "./booking-item-response.dto";
import { BookingResponseDto } from "./booking-response.dto";

export class SyncBookingItemsResponseDto {
	@ApiProperty({ type: BookingItemResponseDto, isArray: true })
	items!: BookingItemResponseDto[];

	@ApiProperty({
		type: BookingResponseDto,
		description: "The Booking with its recalculated totalAmount",
	})
	booking!: BookingResponseDto;
}
