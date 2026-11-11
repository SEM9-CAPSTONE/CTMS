import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

/**
 * CTMS-032-T01. Request body for `POST /bookings/:bookingId/pay`.
 *
 * The Booking ID comes from the route parameter, not this body, so this DTO
 * only carries the payment-specific fields the Camper supplies. Backend
 * computes the authoritative amount from `Booking.totalAmount` (BR-175).
 */
export class PayBookingDto {
	/**
	 * Payment method identifier (e.g. "CARD", "BANK_TRANSFER").
	 * Backend does not charge via a live gateway in Sprint 3; this field is
	 * captured in the request fingerprint for idempotency and audit purposes.
	 */
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	@ApiProperty({
		example: "CARD",
		description: "Payment method identifier, e.g. CARD or BANK_TRANSFER",
		maxLength: 64,
	})
	method!: string;
}
