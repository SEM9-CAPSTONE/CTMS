import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";

export class BookingResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	userId!: string;

	@ApiProperty({ minimum: 1 })
	numPeople!: number;

	@ApiProperty({ enum: BookingStatus })
	status!: BookingStatus;

	@ApiProperty({ enum: BookingPaymentStatus })
	paymentStatus!: BookingPaymentStatus;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	holdExpiresAt!: Date | null;

	@ApiProperty({ type: String, format: "date-time" })
	tripStartsAtSnapshot!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	tripEndsAtSnapshot!: Date;

	@ApiProperty({ type: String, example: "1500000.00" })
	basePrice!: string;

	@ApiPropertyOptional({ type: Object, nullable: true })
	cancellationPolicySnapshot!: Record<string, unknown> | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;
}
