import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class ConfirmManualRefundDto {
	@ApiProperty({ description: "Bank transaction reference or bill identifier", maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	transactionRef!: string;

	@ApiPropertyOptional({ description: "Reconciliation note", maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
