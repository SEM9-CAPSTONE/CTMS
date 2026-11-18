import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { PORTER_REVIEW_COMMENT_MAX_LENGTH } from "../porter-reviews.types";

export class PorterReviewContentDto {
	@ApiProperty({ minimum: 1, maximum: 5 })
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@ApiPropertyOptional({ maxLength: PORTER_REVIEW_COMMENT_MAX_LENGTH, nullable: true })
	@Transform(({ value }: { value: unknown }) =>
		typeof value === "string" ? value.trim() || null : value
	)
	@IsOptional()
	@IsString()
	@MaxLength(PORTER_REVIEW_COMMENT_MAX_LENGTH)
	comment?: string | null;
}

export class CreatePorterReviewDto extends PorterReviewContentDto {
	@ApiProperty({ format: "uuid", description: "Porter account ID returned by review context" })
	@IsUUID()
	porterId!: string;
}

export class UpdatePorterReviewDto extends PorterReviewContentDto {
	@ApiProperty({ minimum: 1, description: "Revision last read by the review owner" })
	@IsInt()
	@Min(1)
	expectedRevision!: number;
}
