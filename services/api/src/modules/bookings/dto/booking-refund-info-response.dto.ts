import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentStatus, PaymentTransactionStatus } from "../entities/payment.entity";
import { RefundOrigin } from "../refund-policy";

export class BookingRefundItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ example: "500000.00" })
	amount!: string;

	@ApiProperty({ enum: PaymentStatus })
	status!: PaymentStatus;

	@ApiPropertyOptional({ enum: PaymentTransactionStatus })
	transactionStatus?: PaymentTransactionStatus;

	@ApiPropertyOptional()
	providerReference?: string | null;

	@ApiPropertyOptional()
	failureReason?: string | null;

	@ApiPropertyOptional()
	bankName?: string | null;

	@ApiPropertyOptional()
	accountNumber?: string | null;

	@ApiPropertyOptional()
	accountHolderName?: string | null;

	@ApiPropertyOptional()
	reason?: string | null;

	@ApiPropertyOptional()
	note?: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;
}

export class BookingRefundApplicableWindowDto {
	@ApiPropertyOptional({ type: String, format: "date-time" })
	startsAt?: Date;

	@ApiPropertyOptional({ type: String, format: "date-time" })
	endsAt?: Date;

	@ApiPropertyOptional({ type: String, format: "date-time" })
	deadline?: Date;

	@ApiProperty()
	isExpired!: boolean;

	@ApiProperty()
	description!: string;
}

export class BookingRefundInfoResponseDto {
	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty()
	isEligible!: boolean;

	@ApiPropertyOptional()
	ineligibleReason?: string;

	@ApiPropertyOptional({ enum: RefundOrigin })
	origin?: RefundOrigin;

	@ApiPropertyOptional()
	policySource?: string;

	@ApiPropertyOptional({ type: BookingRefundApplicableWindowDto })
	applicableWindow?: BookingRefundApplicableWindowDto;

	@ApiPropertyOptional({ example: "1500000.00" })
	chargeAmount?: string;

	@ApiProperty({ example: "0.00" })
	totalRefundedAmount!: string;

	@ApiProperty({ example: "1500000.00" })
	remainingRefundableAmount!: string;

	@ApiProperty({ type: [BookingRefundItemDto] })
	refunds!: BookingRefundItemDto[];

	@ApiProperty()
	settlementBlocked!: boolean;

	@ApiProperty()
	awaitingResolution!: boolean;
}
