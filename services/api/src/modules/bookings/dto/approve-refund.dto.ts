import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApproveRefundDto {
	@ApiPropertyOptional({ description: "Reason for approving this refund", maxLength: 1000 })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	note?: string;
}
