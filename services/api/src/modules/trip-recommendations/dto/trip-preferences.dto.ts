import { ApiProperty } from "@nestjs/swagger";
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsIn,
	IsInt,
	Max,
	Min,
	ValidateIf,
} from "class-validator";
import { TrekkingRouteDifficulty } from "../../trekking-routes/entities/trekking-route.entity";
import { TripActivitiesDto } from "../../trips/dto/trip-activities.dto";
import { TripType } from "../../trips/entities/trip.entity";
import { TRIP_REGIONS, TRIP_REGION_CODES, type TripRegionCode } from "../trip-regions";

export const MAX_PREFERENCE_PRICE_VND = 1_000_000_000;

/** PUT body: replaces every field; empty arrays and null prices clear the choice. */
export class ReplaceTripPreferencesDto extends TripActivitiesDto {
	@ApiProperty({ enum: TripType, isArray: true })
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(Object.values(TripType).length)
	@IsEnum(TripType, { each: true })
	tripTypes!: TripType[];

	@ApiProperty({ enum: TrekkingRouteDifficulty, isArray: true })
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(Object.values(TrekkingRouteDifficulty).length)
	@IsEnum(TrekkingRouteDifficulty, { each: true })
	difficulties!: TrekkingRouteDifficulty[];

	@ApiProperty({ enum: TRIP_REGION_CODES, isArray: true })
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(TRIP_REGION_CODES.length)
	@IsIn(TRIP_REGION_CODES, { each: true })
	regions!: TripRegionCode[];

	@ApiProperty({ type: Number, nullable: true, description: "VND per person" })
	@ValidateIf((_, value) => value !== null)
	@IsInt()
	@Min(0)
	@Max(MAX_PREFERENCE_PRICE_VND)
	minPrice!: number | null;

	@ApiProperty({ type: Number, nullable: true, description: "VND per person" })
	@ValidateIf((_, value) => value !== null)
	@IsInt()
	@Min(0)
	@Max(MAX_PREFERENCE_PRICE_VND)
	maxPrice!: number | null;
}

export class TripRegionOptionDto {
	@ApiProperty({ enum: TRIP_REGION_CODES })
	code!: TripRegionCode;

	@ApiProperty()
	label!: string;
}

export class TripPreferencesResponseDto extends TripActivitiesDto {
	@ApiProperty({ isArray: true })
	activityOptions!: Array<{ code: string; label: string }>;
	@ApiProperty({ enum: TripType, isArray: true })
	tripTypes!: TripType[];

	@ApiProperty({ enum: TrekkingRouteDifficulty, isArray: true })
	difficulties!: TrekkingRouteDifficulty[];

	@ApiProperty({ enum: TRIP_REGION_CODES, isArray: true })
	regions!: TripRegionCode[];

	@ApiProperty({ type: Number, nullable: true })
	minPrice!: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxPrice!: number | null;

	@ApiProperty({ type: Date, nullable: true })
	updatedAt!: Date | null;

	@ApiProperty({ type: TripRegionOptionDto, isArray: true })
	regionOptions!: TripRegionOptionDto[];
}

export const REGION_OPTIONS: TripRegionOptionDto[] = TRIP_REGIONS.map((region) => ({
	code: region.code,
	label: region.label,
}));
