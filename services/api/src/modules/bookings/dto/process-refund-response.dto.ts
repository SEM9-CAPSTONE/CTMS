import { ApiProperty } from "@nestjs/swagger";
import { PaymentStatus, PaymentTransactionStatus } from "../entities/payment.entity";

export class ProcessRefundResponseDto {
	@ApiProperty({ description: "Refund Payment row ID" })
	refundId!: string;

	@ApiProperty({ description: "Booking ID" })
	bookingId!: string;

	@ApiProperty({ description: "Parent charge Payment ID" })
	parentPaymentId!: string;

	@ApiProperty({ description: "Authoritative refund amount (decimal string)", example: "50.00" })
	amount!: string;

	@ApiProperty({ enum: PaymentStatus, description: "Authoritative refund Payment status" })
	status!: PaymentStatus;

	@ApiProperty({
		enum: PaymentTransactionStatus,
		description: "Latest refund transaction status",
	})
	transactionStatus!: PaymentTransactionStatus;

	@ApiProperty({ description: "Provider transaction reference", nullable: true })
	providerReference!: string | null;

	@ApiProperty({ description: "Policy source applied" })
	policySource!: string;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;
}
