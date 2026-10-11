import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectRefundDto {
	@ApiProperty({ description: "Reason for rejecting the refund request", maxLength: 500 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(500)
	rejectionReason!: string;
}
