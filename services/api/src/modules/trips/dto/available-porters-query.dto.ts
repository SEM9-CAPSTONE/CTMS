import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export enum IntendedPorterRole {
	LEAD = "lead",
	SUPPORT = "support",
}

export class AvailablePortersQueryDto {
	@ApiProperty({ enum: IntendedPorterRole })
	@IsEnum(IntendedPorterRole)
	role!: IntendedPorterRole;

	@ApiPropertyOptional({ minimum: 0, description: "Minimum completed years of Porter experience" })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	minExperienceYears?: number;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
