import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PaymentStatus } from "../entities/payment.entity";

export class AdminRefundListQueryDto {
	@ApiPropertyOptional({ default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({ enum: PaymentStatus })
	@IsOptional()
	@IsEnum(PaymentStatus)
	status?: PaymentStatus;

	@ApiPropertyOptional({
		description: "Search by camper name, email, booking ID or transaction ref",
	})
	@IsOptional()
	@IsString()
	search?: string;
}
