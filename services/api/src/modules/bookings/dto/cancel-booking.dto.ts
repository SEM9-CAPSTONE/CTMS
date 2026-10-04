import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, ValidateIf } from "class-validator";

export class CancelBookingDto {
	@ApiPropertyOptional({ maxLength: 255 })
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@ValidateIf((_object: unknown, value: unknown) => value !== undefined)
	@IsString()
	@MaxLength(255)
	reason?: string;
}
