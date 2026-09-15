import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { WaypointType } from "../entities/trip-waypoint.entity";
import type { GeoPoint, TripStatus, TripType } from "../entities/trip.entity";

export class TripWaypointResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	tripId!: string;

	@ApiPropertyOptional()
	checkpointId!: string | null;

	@ApiProperty()
	type!: WaypointType;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	location!: GeoPoint;

	@ApiProperty()
	dayNumber!: number;

	@ApiProperty()
	sequenceOrder!: number;

	@ApiPropertyOptional()
	plannedAt!: Date | null;

	@ApiPropertyOptional()
	durationMinutes!: number | null;

	@ApiPropertyOptional()
	metadata!: Record<string, unknown> | null;
}

export class TripResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	hostId!: string;

	@ApiProperty()
	routeId!: string;

	@ApiProperty()
	title!: string;

	@ApiPropertyOptional()
	description!: string | null;

	@ApiPropertyOptional()
	coverImageUrl!: string | null;

	@ApiPropertyOptional()
	itinerary!: Record<string, unknown> | null;

	@ApiPropertyOptional()
	includes!: Record<string, unknown> | null;

	@ApiPropertyOptional()
	excludes!: Record<string, unknown> | null;

	@ApiProperty()
	tripType!: TripType;

	@ApiProperty()
	durationNights!: number;

	@ApiProperty()
	startsAt!: Date;

	@ApiProperty()
	endsAt!: Date;

	@ApiProperty()
	meetingPoint!: GeoPoint;

	@ApiPropertyOptional()
	meetingAt!: Date | null;

	@ApiProperty()
	bookingDeadline!: Date;

	@ApiProperty()
	capacityMin!: number;

	@ApiProperty()
	capacityMax!: number;

	@ApiProperty()
	seatsTaken!: number;

	@ApiProperty()
	isFree!: boolean;

	@ApiProperty()
	pricePerPerson!: number;

	@ApiProperty()
	provinceCode!: string;

	@ApiProperty()
	cityCode!: string;

	@ApiPropertyOptional()
	cancellationPolicy!: Record<string, unknown> | null;

	@ApiProperty()
	status!: TripStatus;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;

	@ApiProperty({ type: TripWaypointResponseDto, isArray: true })
	waypoints!: TripWaypointResponseDto[];
}
