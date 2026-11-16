import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { SafetyHotspotStatus } from "../safety-hotspots.enums";

const REVIEW_TARGETS = [
	SafetyHotspotStatus.UNDER_REVIEW,
	SafetyHotspotStatus.CONFIRMED,
	SafetyHotspotStatus.DISMISSED,
] as const;

export class ReviewSafetyHotspotDto {
	@ApiProperty({ enum: REVIEW_TARGETS })
	@IsIn(REVIEW_TARGETS)
	status!: (typeof REVIEW_TARGETS)[number];

	@ApiProperty({ minLength: 10, maxLength: 1000 })
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MinLength(10)
	@MaxLength(1000)
	reason!: string;
}
