import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { UserRole, UserStatus } from "../entities/user.entity";

function optionalTrimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

export class ListUsersQueryDto {
	@ApiPropertyOptional({ description: "Search by full name, email, or phone", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({ enum: UserRole })
	@IsOptional()
	@IsEnum(UserRole)
	role?: UserRole;

	@ApiPropertyOptional({ enum: UserStatus })
	@IsOptional()
	@IsEnum(UserStatus)
	status?: UserStatus;

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
