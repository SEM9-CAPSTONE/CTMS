import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsEnum,
	IsISO8601,
	IsInt,
	IsNumber,
	IsOptional,
	Max,
	Min,
	ValidateNested,
} from "class-validator";
import { EmergencyType } from "../sos.enums";

export class SosLocationInputDto {
	@ApiProperty({ description: "Latitude in WGS84", example: 16.0544 })
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ description: "Longitude in WGS84", example: 108.2022 })
	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude!: number;
}

export class CreateSosDto {
	@ApiProperty({
		enum: EmergencyType,
		description: "Category of emergency",
		example: EmergencyType.MEDICAL,
	})
	@IsEnum(EmergencyType)
	emergencyType!: EmergencyType;

	@ApiPropertyOptional({ description: "Current or last known GPS location" })
	@IsOptional()
	@ValidateNested()
	@Type(() => SosLocationInputDto)
	location?: SosLocationInputDto;

	@ApiPropertyOptional({ description: "Device battery percentage (0-100)", example: 85 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	batteryLevel?: number;

	@ApiProperty({
		description: "Timestamp when the emergency was triggered on the device (ISO8601)",
		example: "2026-10-27T10:00:00.000Z",
	})
	@IsISO8601()
	eventTime!: string;
}
