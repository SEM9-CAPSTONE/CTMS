import { ApiProperty } from "@nestjs/swagger";
import {
	GpsLogIngestStatus,
	GpsLogRejectionReason,
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "../gps-tracking.enums";

export class GpsTrackingContextResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ description: "Whether the caller may record GPS breadcrumbs right now" })
	eligible!: boolean;

	@ApiProperty({ enum: GpsTrackingIneligibleReason, nullable: true })
	reason!: GpsTrackingIneligibleReason | null;

	@ApiProperty({ enum: GpsParticipantRole })
	participantRole!: GpsParticipantRole;

	@ApiProperty({ example: 10, description: "Fixed runtime sampling interval (BR-368)" })
	samplingIntervalSeconds!: number;

	@ApiProperty({ example: 30, description: "Fixed gps_log persistence interval (BR-396)" })
	loggingIntervalSeconds!: number;

	@ApiProperty({ example: "v3" })
	configVersion!: string;
}

export class GpsLogIngestResultDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ enum: GpsLogIngestStatus })
	status!: GpsLogIngestStatus;

	@ApiProperty({ enum: GpsLogRejectionReason, nullable: true })
	reason!: GpsLogRejectionReason | null;
}

export class GpsLogIngestResponseDto {
	@ApiProperty({ type: GpsLogIngestResultDto, isArray: true })
	results!: GpsLogIngestResultDto[];
}
