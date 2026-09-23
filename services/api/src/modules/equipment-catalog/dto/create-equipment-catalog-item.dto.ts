import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

/**
 * CTMS-039-T01. No `status` field here on purpose: a new catalog item
 * always starts `active` server-side (BR-175 -- clients may not
 * self-assert state).
 */
export class CreateEquipmentCatalogItemDto {
	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiProperty({ maxLength: 100 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	category!: string;

	@ApiProperty({ minimum: 0 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	quantityTotal!: number;

	@ApiProperty({ minimum: 0 })
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	rentalPricePerDay!: number;

	@ApiPropertyOptional({ maxLength: 500 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@MaxLength(500)
	maintenanceSchedule?: string;
}
