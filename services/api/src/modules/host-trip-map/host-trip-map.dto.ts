import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

import { BehindScheduleLevel } from "../schedule-progress/schedule-progress.evaluator";

export enum HostTripAlertType {
	OFF_ROUTE = "OFF_ROUTE",
	BEHIND_SCHEDULE = "BEHIND_SCHEDULE",
}

export class HostTripAlertsQueryDto {
	@ApiPropertyOptional({ enum: HostTripAlertType })
	@IsOptional()
	@IsEnum(HostTripAlertType)
	alertType?: HostTripAlertType;

	@ApiPropertyOptional({ enum: BehindScheduleLevel })
	@IsOptional()
	@IsEnum(BehindScheduleLevel)
	severity?: BehindScheduleLevel;
}

export class HostTripMapQueryDto {
	@ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(1000000)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
