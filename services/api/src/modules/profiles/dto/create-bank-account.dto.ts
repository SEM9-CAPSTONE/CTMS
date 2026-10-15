import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateBankAccountDto {
	@ApiProperty({ description: "Bank name", example: "Vietcombank", maxLength: 100 })
	@IsNotEmpty({ message: "bankName is required" })
	@IsString({ message: "bankName must be a string" })
	@MaxLength(100, { message: "bankName must not exceed 100 characters" })
	bankName!: string;

	@ApiProperty({ description: "Account number", example: "0123456789", maxLength: 50 })
	@IsNotEmpty({ message: "accountNumber is required" })
	@IsString({ message: "accountNumber must be a string" })
	@MaxLength(50, { message: "accountNumber must not exceed 50 characters" })
	@Matches(/^[0-9A-Za-z]+$/, { message: "accountNumber must contain only alphanumeric characters" })
	accountNumber!: string;

	@ApiProperty({ description: "Account holder name", example: "NGUYEN VAN A", maxLength: 100 })
	@IsNotEmpty({ message: "accountHolderName is required" })
	@IsString({ message: "accountHolderName must be a string" })
	@MaxLength(100, { message: "accountHolderName must not exceed 100 characters" })
	accountHolderName!: string;

	@ApiPropertyOptional({
		description: "Whether this account is designated as default",
		default: false,
	})
	@IsOptional()
	@IsBoolean({ message: "isDefault must be a boolean" })
	isDefault?: boolean;
}
