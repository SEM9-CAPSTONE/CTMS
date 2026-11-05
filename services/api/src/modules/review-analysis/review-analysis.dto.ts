import { ApiHideProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Equals, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
export class AnalysisPageDto {
	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@IsOptional()
	page = 1;
	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	@IsOptional()
	limit = 20;
}
export class EmptyAnalysisRequestDto {
	@ApiHideProperty() @Equals(undefined) _reserved?: never;
}

export class AnalysisInsightsQueryDto extends AnalysisPageDto {
	@ApiPropertyOptional({ enum: ["positive", "neutral", "negative", "mixed"] })
	@IsOptional()
	@IsIn(["positive", "neutral", "negative", "mixed"])
	sentiment?: "positive" | "neutral" | "negative" | "mixed";
}
