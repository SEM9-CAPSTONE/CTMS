import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ReconcileFinancialExceptionDto {
	@ApiProperty({ description: "Target booking UUID for post-settlement/post-payout adjustment" })
	@IsUUID("4", { message: "Đơn đặt chỗ không hợp lệ" })
	bookingId!: string;

	@ApiProperty({
		description: "Reason for the financial adjustment",
		example: "Camper verified medical emergency after trip settlement",
	})
	@IsNotEmpty({ message: "Lý do điều chỉnh không được để trống" })
	@IsString()
	@MaxLength(1000, { message: "Lý do không được vượt quá 1000 ký tự" })
	reason!: string;

	@ApiPropertyOptional({ description: "Optional administrative notes", maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500, { message: "Ghi chú không được vượt quá 500 ký tự" })
	notes?: string;
}
