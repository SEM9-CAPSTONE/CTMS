import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from "class-validator";
import { BloodType, FitnessLevel } from "../entities/health-profile.entity";

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
