import { ApiProperty } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";
import { PaymentStatus } from "../entities/payment.entity";

/**
 * CTMS-032-T01. Response shape for `POST /bookings/:bookingId/pay`.
 *
 * Returns both the Payment row state and the resulting Booking state so the
 * client can display success, pending, or failure without a separate GET
 * (BR-225).
 */
export class PayBookingResponseDto {
	@ApiProperty({ format: "uuid", description: "Authoritative Payment ID" })
	paymentId!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({
		enum: PaymentStatus,
		description: "Current payment status (pending | succeeded | failed)",
	})
	paymentStatus!: PaymentStatus;

	@ApiProperty({
		type: String,
		example: "1500000.00",
		description: "Amount charged — server-computed snapshot of Booking.totalAmount",
	})
	amount!: string;

	@ApiProperty({ enum: BookingStatus, description: "Updated Booking workflow status" })
	bookingStatus!: BookingStatus;

	@ApiProperty({
		enum: BookingPaymentStatus,
		description: "Updated Booking payment status",
	})
	bookingPaymentStatus!: BookingPaymentStatus;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({
		type: String,
		required: false,
		nullable: true,
		description: "PayOS checkout URL for completing payment via VietQR or card",
	})
	checkoutUrl?: string | null;

	@ApiProperty({
		type: String,
		required: false,
		nullable: true,
		description: "VietQR raw QR string",
	})
	qrCode?: string | null;
}
