import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator";

export enum ReviewCampsiteAction {
	APPROVE = "approve",
	DECLINE = "decline",
}

function trimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	return value.trim();
}

export class ReviewCampsiteDto {
	@ApiProperty({ enum: ReviewCampsiteAction, example: "approve" })
	@IsEnum(ReviewCampsiteAction, {
		message: "action must be either 'approve' or 'decline'",
	})
	action!: ReviewCampsiteAction;

	@ApiPropertyOptional({
		maxLength: 500,
		example: "Campsite details do not meet safety requirements.",
	})
	@Transform(({ value }) => trimmedString(value))
	@ValidateIf((dto: ReviewCampsiteDto) => dto.action === ReviewCampsiteAction.DECLINE)
	@IsString({ message: "reason must be a string" })
	@IsNotEmpty({ message: "reason is required when action is decline" })
	@MaxLength(500, { message: "reason cannot exceed 500 characters" })
	reason?: string;
}
