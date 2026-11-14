import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { SAFETY_HOTSPOT_LIST_MAX_LIMIT } from "../safety-hotspots.constants";
import { SafetyHotspotStatus } from "../safety-hotspots.enums";

export class ListSafetyHotspotsQueryDto {
	@ApiPropertyOptional({ description: "Only candidates on this Route" })
	@IsOptional()
	@IsUUID()
	routeId?: string;

	@ApiPropertyOptional({ enum: SafetyHotspotStatus })
	@IsOptional()
	@IsEnum(SafetyHotspotStatus)
	status?: SafetyHotspotStatus;

	@ApiPropertyOptional({ example: 50, maximum: SAFETY_HOTSPOT_LIST_MAX_LIMIT })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(SAFETY_HOTSPOT_LIST_MAX_LIMIT)
	limit?: number;
}
