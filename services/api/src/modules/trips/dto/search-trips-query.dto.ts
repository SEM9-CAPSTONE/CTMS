import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import { TrekkingRouteDifficulty } from "../../trekking-routes/entities/trekking-route.entity";
import { TripType } from "../entities/trip.entity";

function optionalTrimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

export class SearchTripsQueryDto {
	@ApiPropertyOptional({
		description: "Keyword search in trip title or description",
		maxLength: 100,
	})
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({
		enum: TripType,
		description: "Filter by trip type: day_trip or overnight",
	})
	@IsOptional()
	@IsEnum(TripType)
	tripType?: TripType;

	@ApiPropertyOptional({
		enum: TrekkingRouteDifficulty,
		description: "Filter by trekking route difficulty",
	})
	@IsOptional()
	@IsEnum(TrekkingRouteDifficulty)
	difficulty?: TrekkingRouteDifficulty;

	@ApiPropertyOptional({ description: "Filter trips starting on or after this ISO date-time" })
	@IsOptional()
	@IsDateString()
	startDate?: string;

	@ApiPropertyOptional({ description: "Filter trips starting on or before this ISO date-time" })
	@IsOptional()
	@IsDateString()
	endDate?: string;

	@ApiPropertyOptional({ description: "Minimum price per person (VND)", minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minPrice?: number;

	@ApiPropertyOptional({ description: "Maximum price per person (VND)", minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxPrice?: number;

	@ApiPropertyOptional({ description: "Filter by route UUID" })
	@IsOptional()
	@IsUUID()
	routeId?: string;

	@ApiPropertyOptional({ description: "Filter by province name or code", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	province?: string;

	@ApiPropertyOptional({ description: "Filter by city name or code", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => optionalTrimmedString(value))
	@IsString()
	@MaxLength(100)
	city?: string;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
