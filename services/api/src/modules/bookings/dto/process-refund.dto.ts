import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { RefundOrigin } from "../refund-policy";

export class ProcessRefundDto {
	@ApiPropertyOptional({ description: "Optional existing approved refund obligation ID" })
	@IsOptional()
	@IsUUID()
	obligationId?: string;

	@ApiPropertyOptional({
		enum: RefundOrigin,
		description: "Origin/source category of the refund request",
	})
	@IsOptional()
	@IsEnum(RefundOrigin)
	origin?: RefundOrigin;

	@ApiPropertyOptional({
		description: "Refund amount as decimal string (required if obligationId is not provided)",
		example: "50.00",
	})
	@IsOptional()
	@IsString()
	@Matches(/^\d+(\.\d{1,2})?$/, {
		message: "amount must be a positive decimal number with up to 2 decimal places",
	})
	amount?: string;

	@ApiPropertyOptional({ description: "Optional reason for the refund", maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	reason?: string;

	@ApiPropertyOptional({ description: "Beneficiary bank name", maxLength: 100 })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	bankName?: string;

	@ApiPropertyOptional({ description: "Beneficiary account number", maxLength: 50 })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	accountNumber?: string;

	@ApiPropertyOptional({ description: "Beneficiary account holder name", maxLength: 100 })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	accountHolderName?: string;
}
