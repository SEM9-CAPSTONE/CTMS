import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import { REVIEW_COMMENT_MAX_LENGTH, ReviewTarget } from "../trip-reviews.types";

export class ReviewContentDto {
	@ApiPropertyOptional({ type: [String], maxItems: 5 })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(5)
	@ArrayUnique()
	@IsUrl({ require_tld: false }, { each: true })
	images?: string[];

	@ApiProperty({ minimum: 1, maximum: 5 })
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@ApiPropertyOptional({ maxLength: REVIEW_COMMENT_MAX_LENGTH, nullable: true })
	@Transform(({ value }: { value: unknown }) =>
		typeof value === "string" ? value.trim() || null : value
	)
	@IsOptional()
	@IsString()
	@MaxLength(REVIEW_COMMENT_MAX_LENGTH)
	comment?: string | null;
}

export class CreateTripReviewDto extends ReviewContentDto {
	@ApiProperty({ enum: ReviewTarget })
	@IsEnum(ReviewTarget)
	target!: ReviewTarget;
}

export class UpdateTripReviewDto extends ReviewContentDto {
	@ApiProperty({ minimum: 1, description: "Revision last read by the owner" })
	@IsInt()
	@Min(1)
	expectedRevision!: number;
}
