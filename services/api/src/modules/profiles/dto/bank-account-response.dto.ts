import { ApiProperty } from "@nestjs/swagger";
import type { UserBankAccount } from "../entities/user-bank-account.entity";

export class BankAccountResponseDto {
	@ApiProperty({ description: "Unique bank account ID", format: "uuid" })
	id!: string;

	@ApiProperty({ description: "Owner user ID", format: "uuid" })
	userId!: string;

	@ApiProperty({ description: "Bank name", example: "Vietcombank" })
	bankName!: string;

	@ApiProperty({ description: "Account number", example: "0123456789" })
	accountNumber!: string;

	@ApiProperty({ description: "Account holder name", example: "NGUYEN VAN A" })
	accountHolderName!: string;

	@ApiProperty({ description: "Whether this account is designated as default" })
	isDefault!: boolean;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;

	@ApiProperty({ description: "Last update timestamp" })
	updatedAt!: Date;
}

export function toBankAccountResponse(account: UserBankAccount): BankAccountResponseDto {
	return {
		id: account.id,
		userId: account.userId,
		bankName: account.bankName,
		accountNumber: account.accountNumber,
		accountHolderName: account.accountHolderName,
		isDefault: account.isDefault,
		createdAt: account.createdAt,
		updatedAt: account.updatedAt,
	};
}
