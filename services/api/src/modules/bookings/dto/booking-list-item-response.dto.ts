import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";
import { BookingTripPresentationDto } from "./booking-details-response.dto";

export class BookingListItemResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiPropertyOptional({ minimum: 1, nullable: true })
	numPeople!: number | null;

	@ApiPropertyOptional({ enum: BookingStatus, nullable: true })
	status!: BookingStatus | null;

	@ApiPropertyOptional({ enum: BookingPaymentStatus, nullable: true })
	paymentStatus!: BookingPaymentStatus | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	holdExpiresAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	tripStartsAtSnapshot!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	tripEndsAtSnapshot!: Date | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "1700000.00" })
	totalAmount!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiPropertyOptional({ type: BookingTripPresentationDto, nullable: true })
	tripPresentation!: BookingTripPresentationDto | null;
}
