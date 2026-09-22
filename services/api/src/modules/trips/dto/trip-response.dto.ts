import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrekkingRouteDifficulty } from "../../trekking-routes/entities/trekking-route.entity";
import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
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

export class TripSummaryResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	title!: string;

	@ApiPropertyOptional({ nullable: true })
	description!: string | null;

	@ApiPropertyOptional({ nullable: true })
	coverImageUrl!: string | null;

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

	@ApiPropertyOptional({ nullable: true })
	meetingAt!: Date | null;

	@ApiProperty()
	bookingDeadline!: Date;

	@ApiProperty()
	capacityMin!: number;

	@ApiPropertyOptional({ nullable: true })
	capacityMax!: number | null;

	@ApiProperty()
	seatsTaken!: number;

	@ApiPropertyOptional({ nullable: true })
	remainingSeats!: number | null;

	@ApiProperty()
	pricePerPerson!: number;

	@ApiProperty()
	status!: TripStatus;

	@ApiPropertyOptional({ enum: TrekkingRouteDifficulty, nullable: true })
	difficulty!: TrekkingRouteDifficulty | null;

	@ApiPropertyOptional({ enum: RiskLevel, nullable: true })
	weatherRiskLevel!: RiskLevel | null;

	@ApiProperty()
	isBookable!: boolean;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export class TripsPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedTripsResponseDto {
	@ApiProperty({ type: [TripSummaryResponseDto] })
	items!: TripSummaryResponseDto[];

	@ApiProperty({ type: TripsPaginationDto })
	pagination!: TripsPaginationDto;
}

export class TripHostDto {
	@ApiProperty()
	id!: string;

	@ApiPropertyOptional({ nullable: true })
	fullName?: string | null;

	@ApiPropertyOptional({ nullable: true })
	email?: string | null;

	@ApiPropertyOptional({ nullable: true })
	phone?: string | null;

	@ApiPropertyOptional({ nullable: true })
	bio?: string | null;
}

export class TripResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	hostId!: string;

	@ApiPropertyOptional({ type: TripHostDto, nullable: true })
	host?: TripHostDto | null;

	@ApiPropertyOptional({ description: "Route UUID; redacted for Camper callers" })
	routeId?: string;

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

	@ApiPropertyOptional({ nullable: true })
	capacityMax!: number | null;

	@ApiProperty()
	seatsTaken!: number;

	@ApiPropertyOptional({ nullable: true })
	remainingSeats!: number | null;

	@ApiProperty()
	pricePerPerson!: number;

	@ApiPropertyOptional()
	cancellationPolicy!: Record<string, unknown> | null;

	@ApiProperty()
	status!: TripStatus;

	@ApiPropertyOptional({ enum: TrekkingRouteDifficulty, nullable: true })
	difficulty?: TrekkingRouteDifficulty | null;

	@ApiPropertyOptional({ enum: RiskLevel, nullable: true })
	weatherRiskLevel?: RiskLevel | null;

	@ApiProperty()
	isBookable!: boolean;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;

	@ApiProperty({ type: TripWaypointResponseDto, isArray: true })
	waypoints!: TripWaypointResponseDto[];
}
