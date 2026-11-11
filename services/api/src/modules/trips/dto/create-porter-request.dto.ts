import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { IntendedPorterRole } from "./available-porters-query.dto";

export class CreatePorterRequestDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	porterId!: string;

	@ApiProperty({ enum: IntendedPorterRole })
	@IsEnum(IntendedPorterRole)
	requestedRole!: IntendedPorterRole;

	@ApiPropertyOptional({ maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
	note?: string;
}
