import { ApiProperty } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";
import { PaymentStatus } from "../entities/payment.entity";

export class CancellationRefundDto {
	@ApiProperty({ format: "uuid" })
	obligationId!: string;
	@ApiProperty({ type: String })
	amount!: string;
	@ApiProperty({ enum: PaymentStatus })
	status!: PaymentStatus;
}

export class CancelBookingResponseDto {
	@ApiProperty({ format: "uuid" })
	bookingId!: string;
	@ApiProperty({ enum: [BookingStatus.CANCELLED] })
	status!: BookingStatus.CANCELLED;
	@ApiProperty({ type: String, format: "date-time", nullable: true })
	cancelledAt!: Date | null;
	@ApiProperty({ enum: BookingPaymentStatus, nullable: true })
	paymentStatus!: BookingPaymentStatus | null;
	@ApiProperty({ type: CancellationRefundDto, nullable: true })
	refund!: CancellationRefundDto | null;
}
