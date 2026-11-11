import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator";

export enum ReviewTrekkingRouteAction {
	APPROVE = "approve",
	DECLINE = "decline",
	NON_OPERABLE = "non_operable",
}

function trimString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class ReviewTrekkingRouteDto {
	@ApiProperty({ enum: ReviewTrekkingRouteAction })
	@IsEnum(ReviewTrekkingRouteAction)
	action!: ReviewTrekkingRouteAction;

	@ApiPropertyOptional({
		description: "Required for decline and non-operable decisions",
		maxLength: 255,
	})
	@Transform(({ value }) => trimString(value))
	@ValidateIf(
		(dto: ReviewTrekkingRouteDto, value: unknown) =>
			dto.action !== ReviewTrekkingRouteAction.APPROVE || value !== undefined
	)
	@IsString({ message: "reason must be a string" })
	@IsNotEmpty({ message: "reason is required for decline and non-operable decisions" })
	@MaxLength(255, { message: "reason cannot exceed 255 characters" })
	reason?: string;
}
