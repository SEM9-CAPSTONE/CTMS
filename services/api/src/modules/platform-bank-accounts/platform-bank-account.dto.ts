import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export const PLATFORM_BANK_ACCOUNT_PURPOSES = ["weather_penalty"] as const;
export type PlatformBankAccountPurpose = (typeof PLATFORM_BANK_ACCOUNT_PURPOSES)[number];

/** Same rules as a user's bank account (CreateBankAccountDto / the web bank-account form). */
export class UpsertPlatformBankAccountDto {
	@ApiProperty({ example: "Vietcombank", maxLength: 100 })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	bankName!: string;

	@ApiProperty({ example: "1028374659", minLength: 6, maxLength: 20 })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MinLength(6)
	@MaxLength(20)
	@Matches(/^[0-9A-Za-z]+$/, { message: "accountNumber must contain only letters and digits" })
	accountNumber!: string;

	@ApiProperty({ example: "CONG TY TNHH CTMS VIET NAM", minLength: 2, maxLength: 100 })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MinLength(2)
	@MaxLength(100)
	accountHolderName!: string;
}

/** What a payer needs to transfer money to the platform. */
export class PlatformPaymentAccountDto {
	@ApiProperty({ example: "Vietcombank" }) bankName!: string;
	@ApiProperty({ example: "1028374659" }) accountNumber!: string;
	@ApiProperty({ example: "CONG TY TNHH CTMS VIET NAM" }) accountHolderName!: string;
}

export class PlatformBankAccountDto extends PlatformPaymentAccountDto {
	@ApiProperty({ enum: PLATFORM_BANK_ACCOUNT_PURPOSES }) purpose!: PlatformBankAccountPurpose;
	@ApiProperty({ format: "date-time" }) updatedAt!: string;
	@ApiPropertyOptional({ nullable: true, description: "Admin who last changed it" })
	updatedByName!: string | null;
}

/** `null` while no Admin has set the account yet. */
export class PlatformBankAccountResponseDto {
	@ApiPropertyOptional({ type: PlatformBankAccountDto, nullable: true })
	account!: PlatformBankAccountDto | null;
}
