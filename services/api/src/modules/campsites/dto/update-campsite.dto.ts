import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";
import { CreateCampsiteDto } from "./create-campsite.dto";

function optionalTrimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

export class UpdateCampsiteDto extends PartialType(CreateCampsiteDto) {
	@ApiPropertyOptional({
		description: "Current campsite updatedAt value used to reject stale edits",
		example: "2026-08-24T09:00:00.000Z",
	})
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@IsISO8601()
	expectedUpdatedAt?: string;

	@ApiPropertyOptional({ maxLength: 255 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(255)
	changeReason?: string;
}
