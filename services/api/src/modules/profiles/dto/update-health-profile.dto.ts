import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { BloodType, FitnessLevel } from "../entities/health-profile.entity";

export class ActivityProfileInputDto {
	// Accepted for older clients; no longer stored or used for assessment.
	@ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 7, deprecated: true })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(7)
	weeklyActiveDays?: number | null;

	@ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 200 })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(200)
	comfortableDistanceKm?: number | null;

	@ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1440 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1440)
	comfortableWalkingMinutes?: number | null;

	@ApiPropertyOptional({ nullable: true, maxLength: 1200 })
	@IsOptional()
	@IsString()
	@MaxLength(1200)
	activityNotes?: string | null;

	@ApiPropertyOptional({ nullable: true, maxLength: 500, deprecated: true })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	mobilityLimitations?: string | null;

	@ApiPropertyOptional({ nullable: true, maxLength: 500, deprecated: true })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	professionalAdvice?: string | null;

	@ApiPropertyOptional({
		description:
			"Deprecated: saving the health profile records current activity facts automatically",
		deprecated: true,
	})
	@IsOptional()
	@IsBoolean()
	confirmCurrent?: boolean;
}

export class AllergyItemDto {
	@ApiProperty({ description: "Unique identifier for the allergy item" })
	@IsString()
	@IsNotEmpty()
	id!: string;

	@ApiProperty({ description: "Name of the allergen", maxLength: 100 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name!: string;

	@ApiProperty({ enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] })
	@IsEnum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
	severity!: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

	@ApiPropertyOptional({ description: "Allergic reaction description", maxLength: 200 })
	@IsString()
	@IsOptional()
	@MaxLength(200)
	reaction?: string;
}

export class MedicalConditionItemDto {
	@ApiProperty({ description: "Unique identifier for the medical condition" })
	@IsString()
	@IsNotEmpty()
	id!: string;

	@ApiProperty({ description: "Name of the medical condition", maxLength: 100 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name!: string;

	@ApiPropertyOptional({ description: "Prescribed medication", maxLength: 200 })
	@IsString()
	@IsOptional()
	@MaxLength(200)
	medication?: string;

	@ApiPropertyOptional({ description: "Special notes", maxLength: 300 })
	@IsString()
	@IsOptional()
	@MaxLength(300)
	notes?: string;
}

export class UpdateHealthProfileDto {
	@ApiPropertyOptional({ type: ActivityProfileInputDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => ActivityProfileInputDto)
	activityProfile?: ActivityProfileInputDto;
	@ApiProperty({ enum: BloodType })
	@IsEnum(BloodType)
	bloodType!: BloodType;

	@ApiProperty({ enum: FitnessLevel })
	@IsEnum(FitnessLevel)
	physicalFitnessLevel!: FitnessLevel;

	@ApiPropertyOptional({ maxLength: 300 })
	@IsString()
	@IsOptional()
	@MaxLength(300)
	dietaryRestrictions?: string;

	@ApiPropertyOptional({ maxLength: 500 })
	@IsString()
	@IsOptional()
	@MaxLength(500)
	emergencyNotes?: string;

	@ApiProperty({ type: [AllergyItemDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => AllergyItemDto)
	allergies!: AllergyItemDto[];

	@ApiProperty({ type: [MedicalConditionItemDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MedicalConditionItemDto)
	medicalConditions!: MedicalConditionItemDto[];

	@ApiProperty()
	@IsBoolean()
	isConsentGranted!: boolean;
}
