import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RefundCallbackDto {
	@ApiProperty({ description: "Provider reference matching the refund transaction" })
	@IsString()
	@IsNotEmpty()
	providerReference!: string;

	@ApiPropertyOptional({ description: "Provider transaction reference or attempt code" })
	@IsOptional()
	@IsString()
	transactionRef?: string;

	@ApiProperty({ description: "Whether the provider refund succeeded" })
	@IsBoolean()
	isSuccess!: boolean;

	@ApiPropertyOptional({ description: "Arbitrary payload for audit" })
	@IsOptional()
	payload?: Record<string, unknown>;
}
