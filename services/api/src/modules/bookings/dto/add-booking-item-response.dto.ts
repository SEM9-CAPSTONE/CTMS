import { ApiProperty } from "@nestjs/swagger";
import { BookingItemResponseDto } from "./booking-item-response.dto";
import { BookingResponseDto } from "./booking-response.dto";

export class AddBookingItemResponseDto {
	@ApiProperty({ type: BookingItemResponseDto })
	item!: BookingItemResponseDto;

	@ApiProperty({
		type: BookingResponseDto,
		description: "The Booking with its recalculated totalAmount",
	})
	booking!: BookingResponseDto;
}
