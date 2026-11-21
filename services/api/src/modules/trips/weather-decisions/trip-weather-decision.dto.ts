import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsISO8601,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";
import { weatherAlertMessage } from "./trip-weather-decision.policy";
import type {
	TripWeatherDecisionAlertRow,
	TripWeatherDecisionRow,
} from "./trip-weather-decisions.repository";

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export const HOST_WEATHER_DECISIONS = ["keep", "reschedule", "cancel"] as const;
export const ADMIN_WEATHER_DECISIONS = ["keep", "reschedule", "cancel", "pause", "resume"] as const;

class WeatherDecisionBaseDto {
	@ApiProperty({ maxLength: 450, description: "Mandatory reason (policy §5.2)" })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(450)
	reason!: string;

	@ApiPropertyOptional({ format: "date-time", description: "New start, for reschedule" })
	@IsOptional()
	@IsISO8601({ strict: true })
	startsAt?: string;

	@ApiPropertyOptional({ format: "date-time", description: "New end, for reschedule" })
	@IsOptional()
	@IsISO8601({ strict: true })
	endsAt?: string;
}

export class HostWeatherDecisionDto extends WeatherDecisionBaseDto {
	@ApiProperty({ enum: HOST_WEATHER_DECISIONS })
	@IsIn(HOST_WEATHER_DECISIONS)
	decision!: (typeof HOST_WEATHER_DECISIONS)[number];

	@ApiPropertyOptional({ maxLength: 1000, description: "Required when keeping a Red Trip" })
	@IsOptional()
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MaxLength(1000)
	safetyPlan?: string;
}

export class AdminWeatherDecisionDto extends WeatherDecisionBaseDto {
	@ApiProperty({ enum: ADMIN_WEATHER_DECISIONS })
	@IsIn(ADMIN_WEATHER_DECISIONS)
	decision!: (typeof ADMIN_WEATHER_DECISIONS)[number];
}

export class WeatherRescheduleResponseDto {
	@ApiProperty({
		description: "true = keep the booking on the new date; false = cancel with a full refund",
	})
	@IsBoolean()
	accept!: boolean;
}

export class TripWeatherDecisionDto {
	@ApiProperty() id!: string;
	@ApiProperty() tripId!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) forecastId!: string | null;
	@ApiPropertyOptional({ nullable: true, enum: ["green", "yellow", "red"] }) riskLevel!:
		| string
		| null;
	@ApiPropertyOptional({ nullable: true, type: String }) decidedBy!: string | null;
	@ApiPropertyOptional({ nullable: true, type: String }) deciderName!: string | null;
	@ApiProperty({ enum: ["host", "admin", "system"] }) deciderRole!: string;
	@ApiProperty({ enum: ADMIN_WEATHER_DECISIONS }) decision!: string;
	@ApiProperty() reason!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) safetyPlan!: string | null;
	@ApiProperty({ description: "Host decided after the T-24h deadline" }) late!: boolean;
	@ApiProperty() tripStartsAt!: Date;
	@ApiProperty() createdAt!: Date;
}

export class TripWeatherDecisionLogDto {
	@ApiProperty() tripId!: string;
	@ApiProperty() tripStatus!: string;
	@ApiProperty() startsAt!: Date;
	@ApiPropertyOptional({ nullable: true, type: Date }) weatherPausedAt!: Date | null;
	@ApiPropertyOptional({ nullable: true, type: String }) weatherPauseReason!: string | null;
	@ApiPropertyOptional({ nullable: true, enum: ["green", "yellow", "red"] }) latestRiskLevel!:
		| string
		| null;
	@ApiProperty({ description: "Inside the last 3 days, so a weather decision is possible" })
	withinDecisionWindow!: boolean;
	@ApiProperty({ type: [TripWeatherDecisionDto] }) decisions!: TripWeatherDecisionDto[];
}

export class WeatherInterventionDto {
	@ApiProperty() tripId!: string;
	@ApiProperty() tripTitle!: string;
	@ApiProperty() hostId!: string;
	@ApiProperty() startsAt!: Date;
	@ApiProperty() forecastId!: string;
	@ApiProperty({ enum: ["no_response", "host_kept"] }) reason!: string;
	@ApiProperty({ enum: ["normal", "urgent", "critical"] }) urgency!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) hostDecisionReason!: string | null;
	@ApiPropertyOptional({ nullable: true, type: String }) hostSafetyPlan!: string | null;
	@ApiPropertyOptional({ nullable: true, type: Date }) weatherPausedAt!: Date | null;
}

export class TripWeatherDecisionAlertDto {
	@ApiProperty() id!: string;
	@ApiProperty() tripId!: string;
	@ApiProperty({ enum: ["host_t48", "admin_t24", "admin_t12", "admin_t6", "admin_kept"] })
	milestone!: string;
	@ApiProperty({ enum: ["normal", "urgent", "critical"] }) urgency!: string;
	@ApiProperty() tripTitle!: string;
	@ApiProperty() tripStartsAt!: Date;
	@ApiProperty({ description: "Ready-to-show Vietnamese message" }) message!: string;
	@ApiPropertyOptional({ nullable: true, type: Date }) readAt!: Date | null;
	@ApiProperty() createdAt!: Date;
}

export class TripWeatherDecisionAlertListDto {
	@ApiProperty({ type: [TripWeatherDecisionAlertDto] }) items!: TripWeatherDecisionAlertDto[];
	@ApiProperty() unreadCount!: number;
}

export class WeatherRescheduleResponseResultDto {
	@ApiProperty() bookingId!: string;
	@ApiProperty({ enum: ["confirmed", "cancelled"] }) status!: string;
	@ApiProperty({ description: "Refund obligations created (0 or 1)" }) refundsCreated!: number;
}

export function toTripWeatherDecisionDto(row: TripWeatherDecisionRow): TripWeatherDecisionDto {
	return { ...row };
}

export function toTripWeatherDecisionAlertDto(
	row: TripWeatherDecisionAlertRow
): TripWeatherDecisionAlertDto {
	return {
		id: row.id,
		tripId: row.tripId,
		milestone: row.milestone,
		urgency: row.urgency,
		tripTitle: row.tripTitle,
		tripStartsAt: row.tripStartsAt,
		message: weatherAlertMessage(row.milestone, row.tripTitle),
		readAt: row.readAt,
		createdAt: row.createdAt,
	};
}
