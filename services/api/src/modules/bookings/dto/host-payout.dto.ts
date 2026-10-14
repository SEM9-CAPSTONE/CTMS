import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestHostPayoutDto {
	@ApiProperty({ description: "Beneficiary bank name", example: "Vietcombank" })
	@IsNotEmpty({ message: "Ngân hàng thụ hưởng không được để trống" })
	@IsString()
	@MaxLength(100)
	bankName!: string;

	@ApiProperty({ description: "Beneficiary bank account number", example: "0123456789" })
	@IsNotEmpty({ message: "Số tài khoản ngân hàng không được để trống" })
	@IsString()
	@MaxLength(50)
	accountNumber!: string;

	@ApiProperty({ description: "Beneficiary account holder name", example: "NGUYEN VAN A" })
	@IsNotEmpty({ message: "Tên chủ tài khoản không được để trống" })
	@IsString()
	@MaxLength(100)
	accountHolderName!: string;

	@ApiPropertyOptional({ description: "Optional notes for the withdrawal", maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	notes?: string;
}

export class ConfirmHostPayoutDto {
	@ApiProperty({ description: "Bank transaction reference number", example: "FT2610149999" })
	@IsNotEmpty({ message: "Mã giao dịch ngân hàng là bắt buộc" })
	@IsString()
	@MaxLength(255)
	transactionRef!: string;

	@ApiPropertyOptional({ description: "Optional reconciliation note" })
	@IsOptional()
	@IsString()
	adminNotes?: string;
}

export class RejectHostPayoutDto {
	@ApiProperty({ description: "Reason for rejecting the payout" })
	@IsNotEmpty({ message: "Lý do từ chối là bắt buộc" })
	@IsString()
	@MaxLength(255)
	rejectionReason!: string;
}

export class HostWalletResponseDto {
	@ApiProperty({ description: "Wallet ID" })
	id!: string;

	@ApiProperty({ description: "Host ID" })
	hostId!: string;

	@ApiProperty({ description: "Available wallet balance (VND)" })
	balance!: string;

	@ApiPropertyOptional({ description: "Active pending payout if one exists" })
	pendingPayout?: {
		id: string;
		amount: string;
		bankName: string;
		accountNumber: string;
		accountHolderName: string;
		createdAt: Date;
	} | null;

	@ApiProperty({ description: "Recent ledger transactions", type: [Object] })
	transactions!: Array<{
		id: string;
		type: string;
		baseAmount: string;
		feeAmount: string;
		netAmount: string;
		balanceAfter: string;
		description: string;
		createdAt: Date;
	}>;
}
