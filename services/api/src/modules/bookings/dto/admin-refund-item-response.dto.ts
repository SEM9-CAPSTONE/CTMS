import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentStatus, PaymentTransactionStatus } from "../entities/payment.entity";

export class AdminRefundBeneficiaryDto {
	@ApiPropertyOptional()
	bankName?: string | null;

	@ApiPropertyOptional()
	accountNumber?: string | null;

	@ApiPropertyOptional()
	accountHolderName?: string | null;
}

export class AdminRefundCamperDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	fullName!: string;

	@ApiPropertyOptional()
	email?: string | null;

	@ApiPropertyOptional()
	phone?: string | null;
}

export class AdminRefundItemResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiPropertyOptional()
	tripTitle?: string;

	@ApiProperty({ type: AdminRefundCamperDto })
	camper!: AdminRefundCamperDto;

	@ApiProperty({ example: "500000.00" })
	amount!: string;

	@ApiProperty({ enum: PaymentStatus })
	status!: PaymentStatus;

	@ApiPropertyOptional({ enum: PaymentTransactionStatus })
	transactionStatus?: PaymentTransactionStatus;

	@ApiPropertyOptional()
	providerReference?: string | null;

	@ApiPropertyOptional()
	reason?: string | null;

	@ApiPropertyOptional()
	rejectionReason?: string | null;

	@ApiPropertyOptional()
	note?: string | null;

	@ApiPropertyOptional({ type: AdminRefundBeneficiaryDto })
	beneficiary?: AdminRefundBeneficiaryDto;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}

export class AdminRefundListResponseDto {
	@ApiProperty({ type: [AdminRefundItemResponseDto] })
	items!: AdminRefundItemResponseDto[];

	@ApiProperty()
	total!: number;

	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	totalPages!: number;
}
