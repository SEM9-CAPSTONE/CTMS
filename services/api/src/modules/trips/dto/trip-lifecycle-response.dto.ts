import { ApiProperty } from "@nestjs/swagger";
import { TripStatus } from "../entities/trip.entity";

export enum TripLifecycleBlock {
	INVALID_STATE = "TRIP_LIFECYCLE_INVALID_STATE",
	TOO_EARLY = "TRIP_START_TOO_EARLY",
	SCHEDULE_ENDED = "TRIP_START_SCHEDULE_ENDED",
	WEATHER_PAUSED = "TRIP_WEATHER_PAUSED",
	ROUTE_UNAVAILABLE = "TRIP_ROUTE_UNAVAILABLE",
	INSUFFICIENT_PARTICIPANTS = "TRIP_INSUFFICIENT_PARTICIPANTS",
}

export class TripLifecycleResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	title!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty({ type: String, format: "date-time" })
	startsAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	endsAt!: Date;

	@ApiProperty({ type: String, format: "date-time", nullable: true })
	actualStartedAt!: Date | null;

	@ApiProperty({ type: String, format: "date-time", nullable: true })
	actualEndedAt!: Date | null;

	@ApiProperty()
	canStart!: boolean;

	@ApiProperty()
	canEnd!: boolean;

	@ApiProperty({ type: String, nullable: true })
	startBlockedReason!: string | null;
}
