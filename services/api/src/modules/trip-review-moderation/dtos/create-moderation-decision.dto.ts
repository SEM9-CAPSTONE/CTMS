import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateIf,
} from "class-validator";
import type { ModerationFlagType } from "../trip-review-moderation.types";

export enum ModerationDecisionAction {
	KEEP = "keep",
	HIDE = "hide",
	RESTORE = "restore",
}

export enum ModerationFlagTypeEnum {
	PROFANITY_OR_INSULT = "profanity_or_insult",
	PERSONAL_DATA_LEAK = "personal_data_leak",
	SPAM_OR_IRRELEVANT = "spam_or_irrelevant",
	HARASSMENT = "harassment",
	INAPPROPRIATE_IMAGE = "inappropriate_image",
}

export class CreateModerationDecisionDto {
	@ApiProperty({
		description: "The review revision last read by the host to prevent race conditions",
		minimum: 1,
	})
	@IsInt()
	@Min(1)
	expectedRevision!: number;

	@ApiProperty({
		enum: ModerationDecisionAction,
		description:
			"Action to take on the flagged review: keep (remain visible), hide (moderate), or restore (unhide)",
	})
	@IsEnum(ModerationDecisionAction)
	decision!: ModerationDecisionAction;

	@ApiPropertyOptional({
		enum: ModerationFlagTypeEnum,
		description:
			"Reason for hiding the review. Mandatory when decision is 'hide' and must match an active flag.",
	})
	@ValidateIf((o: CreateModerationDecisionDto) => o.decision === ModerationDecisionAction.HIDE)
	@IsNotEmpty({ message: "Reason is required when hiding a review" })
	@IsEnum(ModerationFlagTypeEnum, {
		message: "Reason must be one of the recognized violation categories",
	})
	reason?: ModerationFlagType;

	@ApiPropertyOptional({
		description: "Optional internal note or explanation from the host",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
