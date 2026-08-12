import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class AccountStatusActionDto {
	@ApiPropertyOptional({ maxLength: 255, description: "Optional administrative reason" })
	@IsOptional()
	@Transform(({ value }) => {
		if (typeof value !== "string") {
			return value;
		}
		const trimmed = value.trim();
		return trimmed === "" ? undefined : trimmed;
	})
	@IsString()
	@MaxLength(255)
	reason?: string;
}
