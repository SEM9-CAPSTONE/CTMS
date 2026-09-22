import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator";

export enum ReviewTripAction {
	APPROVE = "approve",
	DECLINE = "decline",
}

function trimString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

/**
 * CTMS-023-T01. Mirrors ReviewTrekkingRouteDto's own action+reason shape --
 * the same Admin review convention already proven for CTMS-13, applied here
 * to Trip's pending_approval -> published/draft transition.
 */
export class ReviewTripDto {
	@ApiProperty({ enum: ReviewTripAction })
	@IsEnum(ReviewTripAction)
	action!: ReviewTripAction;

	@ApiPropertyOptional({
		description: "Required for a decline decision",
		maxLength: 255,
	})
	@Transform(({ value }) => trimString(value))
	@ValidateIf(
		(dto: ReviewTripDto, value: unknown) =>
			dto.action !== ReviewTripAction.APPROVE || value !== undefined
	)
	@IsString({ message: "reason must be a string" })
	@IsNotEmpty({ message: "reason is required for a decline decision" })
	@MaxLength(255, { message: "reason cannot exceed 255 characters" })
	reason?: string;
}
