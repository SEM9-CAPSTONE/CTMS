import { ApiProperty } from "@nestjs/swagger";
import { BookingStatus } from "../../profiles/entities/booking.entity";

export class CompleteBookingResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ enum: BookingStatus, example: BookingStatus.COMPLETED })
	status!: BookingStatus;

	@ApiProperty({ type: String, format: "date-time" })
	completedAt!: string;
}
