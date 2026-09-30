import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class RescheduleTripDto {
	@ApiPropertyOptional({ format: "date-time" })
	@IsOptional()
	@IsISO8601({ strict: true })
	startsAt?: string;

	@ApiPropertyOptional({ format: "date-time" })
	@IsOptional()
	@IsISO8601({ strict: true })
	endsAt?: string;
}

export class CancelTripDto {
	@ApiProperty({ maxLength: 500 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	reason!: string;
}
