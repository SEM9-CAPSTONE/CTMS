import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, Min, ValidateIf } from "class-validator";
import { PorterAvailabilityStatus } from "../entities/porter-profile.entity";
import { IsNormalizedStringArray } from "./normalized-string-array.validator";

export class UpdatePorterProfileDto {
	@ApiPropertyOptional({ minimum: 0, example: 4 })
	@ValidateIf((_dto: UpdatePorterProfileDto, value: unknown) => value !== undefined)
	@IsInt()
	@Min(0)
	experienceYears?: number;

	@ApiPropertyOptional({ type: [String], maxItems: 20 })
	@ValidateIf((_dto: UpdatePorterProfileDto, value: unknown) => value !== undefined)
	@IsNormalizedStringArray()
	certifications?: string[];

	@ApiPropertyOptional({ type: [String], maxItems: 20 })
	@ValidateIf((_dto: UpdatePorterProfileDto, value: unknown) => value !== undefined)
	@IsNormalizedStringArray()
	languages?: string[];

	@ApiPropertyOptional({ enum: PorterAvailabilityStatus })
	@ValidateIf((_dto: UpdatePorterProfileDto, value: unknown) => value !== undefined)
	@IsEnum(PorterAvailabilityStatus)
	availabilityStatus?: PorterAvailabilityStatus;

	@ApiPropertyOptional({ minimum: 1, description: "Required only when the profile exists" })
	@ValidateIf((_dto: UpdatePorterProfileDto, value: unknown) => value !== undefined)
	@IsInt()
	@Min(1)
	expectedVersion?: number;
}
