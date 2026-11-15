import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsDefined,
	IsEnum,
	IsNotEmpty,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
	ValidateIf,
	ValidateNested,
} from "class-validator";
import { CreateRouteDangerZoneDto } from "../../trekking-routes/dto/create-route-danger-zone.dto";
import { CorrectiveActionType } from "../safety-hotspots.enums";

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

const HAZARD_ACTIONS = new Set([
	CorrectiveActionType.ADD_HAZARD_AREA,
	CorrectiveActionType.UPDATE_HAZARD_AREA,
]);

/**
 * CTMS-118 corrective action on a CONFIRMED hotspot. Targets are always resolved against the
 * hotspot's own Route on the server; a hazard area reuses the Host creation DTO and validators.
 */
export class CreateCorrectiveActionDto {
	@ApiProperty({ enum: CorrectiveActionType })
	@IsEnum(CorrectiveActionType)
	actionType!: CorrectiveActionType;

	@ApiProperty({
		minLength: 10,
		maxLength: 1000,
		description: "Why this action follows from the confirmed evidence",
	})
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MinLength(10)
	@MaxLength(1000)
	reason!: string;

	@ApiPropertyOptional({ type: CreateRouteDangerZoneDto })
	@ValidateIf((dto: CreateCorrectiveActionDto) => HAZARD_ACTIONS.has(dto.actionType))
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateRouteDangerZoneDto)
	hazardArea?: CreateRouteDangerZoneDto;

	@ApiPropertyOptional({ format: "uuid", description: "Hazard area of the hotspot's Route" })
	@ValidateIf(
		(dto: CreateCorrectiveActionDto) => dto.actionType === CorrectiveActionType.UPDATE_HAZARD_AREA
	)
	@IsUUID()
	hazardAreaId?: string;

	@ApiPropertyOptional({ format: "uuid", description: "Checkpoint of the hotspot's Route" })
	@ValidateIf(
		(dto: CreateCorrectiveActionDto) =>
			dto.actionType === CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS
	)
	@IsUUID()
	checkpointId?: string;

	@ApiPropertyOptional({ maxLength: 1000 })
	@ValidateIf(
		(dto: CreateCorrectiveActionDto) =>
			dto.actionType === CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS
	)
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	instructions?: string;
}
