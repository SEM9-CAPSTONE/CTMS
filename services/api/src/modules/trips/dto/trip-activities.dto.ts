import { ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, ValidateIf } from "class-validator";
import { TRIP_ACTIVITY_CODES } from "../trip-activities";
export class TripActivitiesDto {
	@ApiPropertyOptional({ enum: TRIP_ACTIVITY_CODES, isArray: true })
	@ValidateIf((_, value) => value !== undefined)
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(TRIP_ACTIVITY_CODES.length)
	@IsIn(TRIP_ACTIVITY_CODES, { each: true })
	activities?: string[];
}
