import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from "class-validator";
import { EquipmentCatalogStatus } from "../equipment-catalog-status.enum";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

/**
 * CTMS-039-T01. Partial update -- every field optional, only supplied
 * fields are validated and applied. `status` transitions freely among the 3
 * MVP values (no restricted state machine is defined anywhere in the
 * approved spec/BR text for this story).
 */
export class UpdateEquipmentCatalogItemDto {
	@ApiPropertyOptional({ maxLength: 150 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name?: string;

	@ApiPropertyOptional({ maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	category?: string;

	@ApiPropertyOptional({ minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	quantityTotal?: number;

	@ApiPropertyOptional({ minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	rentalPricePerDay?: number;

	@ApiPropertyOptional({ enum: EquipmentCatalogStatus })
	@IsOptional()
	@IsEnum(EquipmentCatalogStatus)
	status?: EquipmentCatalogStatus;

	@ApiPropertyOptional({ maxLength: 500, nullable: true })
	@IsOptional()
	@Transform(({ value }) => (value === null ? null : trimmedString(value)))
	@IsString()
	@MaxLength(500)
	maintenanceSchedule?: string | null;
}
