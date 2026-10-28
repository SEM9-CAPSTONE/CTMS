import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsDefined,
	IsEnum,
	IsInt,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateIf,
} from "class-validator";
import { IsNormalizedStringArray } from "../profiles/dto/normalized-string-array.validator";
import { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
import { LevelDecisionOutcome } from "./porter-levels.types";

export class LevelParamDto {
	@ApiProperty({ enum: PorterRouteProficiency })
	@IsEnum(PorterRouteProficiency)
	level!: PorterRouteProficiency;
}

export class LevelComparisonParamDto extends LevelParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	id!: string;
}

export class SaveLevelPolicyDto {
	@ApiProperty({ minimum: 0, description: "0 creates a previously unconfigured policy" })
	@IsInt()
	@Min(0)
	expectedVersion!: number;

	@ApiProperty()
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name!: string;

	@ApiProperty({
		type: Number,
		nullable: true,
		description: "Explicit null means no numeric condition configured",
	})
	@IsDefined()
	@ValidateIf((_dto: SaveLevelPolicyDto, value: unknown) => value !== null)
	@IsInt()
	@Min(0)
	minExperienceYears!: number | null;

	@ApiProperty({ type: Number, nullable: true })
	@IsDefined()
	@ValidateIf((_dto: SaveLevelPolicyDto, value: unknown) => value !== null)
	@IsInt()
	@Min(0)
	minTimesLed!: number | null;

	@ApiProperty({ type: [String], maxItems: 20 })
	@IsNormalizedStringArray()
	requiredSkills!: string[];

	@ApiProperty({ type: [String], maxItems: 20 })
	@IsNormalizedStringArray()
	requiredCertifications!: string[];

	@ApiProperty()
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MinLength(1)
	@MaxLength(2000)
	responsibilities!: string;
}

export class SaveLevelEvidenceDto {
	@ApiProperty({ minimum: 0 })
	@IsInt()
	@Min(0)
	expectedVersion!: number;

	@ApiProperty({ type: [String], maxItems: 20 })
	@IsNormalizedStringArray()
	skills!: string[];
}

export class DecidePorterLevelDto {
	@ApiProperty({ enum: PorterRouteProficiency })
	@IsEnum(PorterRouteProficiency)
	level!: PorterRouteProficiency;

	@ApiProperty({ enum: LevelDecisionOutcome })
	@IsEnum(LevelDecisionOutcome)
	outcome!: LevelDecisionOutcome;

	@ApiProperty()
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MinLength(1)
	@MaxLength(2000)
	reason!: string;

	@ApiProperty({ minimum: 1 })
	@IsInt()
	@Min(1)
	expectedQualificationVersion!: number;

	@ApiProperty({ minimum: 1 })
	@IsInt()
	@Min(1)
	expectedPolicyVersion!: number;

	@ApiProperty({
		description: "Fingerprint from the server comparison; stale evidence must be reviewed again",
	})
	@IsString()
	@Matches(/^[a-f0-9]{64}$/)
	expectedDossierHash!: string;
}

export class ListLevelQualificationsDto {
	@ApiPropertyOptional({ default: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
