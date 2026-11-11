import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator";
import {
	EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH,
	EmergencyAlertType,
} from "../emergency-broadcasts.types";

/**
 * CTMS-081. Only Trip scope exists: any extra field such as `area`, `radius` or `recipients` is
 * rejected by the global `forbidNonWhitelisted` validation (AC4/PB AC-6).
 */
export class CreateEmergencyBroadcastDto {
	@ApiProperty({
		format: "uuid",
		description: "Client-generated ID; retrying with the same ID never creates a second broadcast",
	})
	@IsUUID()
	id!: string;

	@ApiProperty({ enum: EmergencyAlertType })
	@IsEnum(EmergencyAlertType)
	alertType!: EmergencyAlertType;

	@ApiProperty({ minLength: 1, maxLength: EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH })
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH)
	content!: string;
}

export class EmergencyBroadcastResponseDto {
	@ApiProperty() id!: string;
	@ApiProperty() tripId!: string;
	@ApiProperty() hostId!: string;
	@ApiProperty({ enum: EmergencyAlertType }) alertType!: EmergencyAlertType;
	@ApiProperty() content!: string;
	@ApiPropertyOptional({
		nullable: true,
		type: Number,
		description: "Number of addressed members/Porters; Host only",
	})
	recipientCount!: number | null;
	@ApiProperty() createdAt!: string;
}
