import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingMemberStatus } from "../../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../../gps-tracking/gps-tracking.enums";
import { SafetyEventType } from "../../safety-events/safety-events.enums";
import { ScheduleStatus } from "../../schedule-progress/schedule-progress.evaluator";
import { LocationFreshness } from "../member-locations.types";

/** OpenAPI description of the CTMS-066 response (`GET /trips/:tripId/member-locations`). */
export class SyncedLocationDto {
	@ApiProperty() id!: string;
	@ApiProperty() latitude!: number;
	@ApiProperty() longitude!: number;
	@ApiProperty() accuracyMeters!: number;
	@ApiProperty({ description: "Device capture time" }) eventTime!: string;
	@ApiProperty({ description: "Server acceptance time" }) receivedAt!: string;
}

export class SyncedSafetyTransitionDto {
	@ApiProperty({ enum: SafetyEventType }) type!: SafetyEventType;
	@ApiProperty() eventTime!: string;
	@ApiProperty() receivedAt!: string;
}

export class SyncedCheckpointVisitDto {
	@ApiProperty() checkpointId!: string;
	@ApiProperty() checkpointName!: string;
	@ApiProperty() arrivedAt!: string;
	@ApiProperty() receivedAt!: string;
}

export class BehindScheduleReferenceDto {
	@ApiProperty() checkpointId!: string;
	@ApiProperty() checkpointName!: string;
	@ApiProperty() porterArrivedAt!: string;
}

export class BehindScheduleSafeCheckpointDto {
	@ApiProperty() id!: string;
	@ApiProperty() name!: string;
	@ApiProperty() type!: string;
}

export class BehindScheduleFlagDto {
	@ApiProperty({ enum: ScheduleStatus }) status!: ScheduleStatus;
	@ApiPropertyOptional({ nullable: true, type: Number }) lagMinutes!: number | null;
	@ApiPropertyOptional({ nullable: true, type: BehindScheduleReferenceDto })
	reference!: BehindScheduleReferenceDto | null;
	@ApiPropertyOptional({ nullable: true, type: BehindScheduleSafeCheckpointDto })
	safeCheckpoint!: BehindScheduleSafeCheckpointDto | null;
	@ApiProperty() evaluatedAt!: string;
}

export class MemberSafetyDto {
	@ApiPropertyOptional({ nullable: true, type: SyncedSafetyTransitionDto })
	route!: SyncedSafetyTransitionDto | null;
	@ApiPropertyOptional({ nullable: true, type: SyncedSafetyTransitionDto })
	gps!: SyncedSafetyTransitionDto | null;
	@ApiPropertyOptional({ nullable: true, type: SyncedCheckpointVisitDto })
	lastCheckpoint!: SyncedCheckpointVisitDto | null;
	@ApiPropertyOptional({
		nullable: true,
		type: BehindScheduleFlagDto,
		description:
			"Campers only. Null means no evaluation is available, never that the member is safe.",
	})
	behindSchedule!: BehindScheduleFlagDto | null;
}

export class MemberLocationDto {
	@ApiProperty({ description: "Booking-member ID (Camper) or user ID (Porter)" }) id!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) userId!: string | null;
	@ApiPropertyOptional({ nullable: true, type: String }) name!: string | null;
	@ApiProperty({ enum: GpsParticipantRole }) role!: GpsParticipantRole;
	@ApiPropertyOptional({ nullable: true, enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus | null;
	@ApiPropertyOptional({ nullable: true, type: SyncedLocationDto })
	location!: SyncedLocationDto | null;
	@ApiPropertyOptional({
		nullable: true,
		type: String,
		description: "last_seen_at: capture time of `location`",
	})
	lastSeenAt!: string | null;
	@ApiPropertyOptional({
		nullable: true,
		type: String,
		description: "Latest server receipt of any device upload",
	})
	lastSyncedAt!: string | null;
	@ApiProperty({ enum: LocationFreshness }) freshness!: LocationFreshness;
	@ApiPropertyOptional({ nullable: true, type: Number }) locationAgeSeconds!: number | null;
	@ApiProperty({ type: MemberSafetyDto }) safety!: MemberSafetyDto;
}

export class TripMemberLocationsDto {
	@ApiProperty() tripId!: string;
	@ApiProperty() tripStatus!: string;
	@ApiProperty({ enum: ["host", "porter"] }) viewer!: "host" | "porter";
	@ApiProperty() generatedAt!: string;
	@ApiProperty({ enum: ["server_confirmed"] }) locationSource!: "server_confirmed";
	@ApiProperty() freshnessMaxAgeSeconds!: number;
	@ApiProperty({ type: [MemberLocationDto] }) members!: MemberLocationDto[];
}
