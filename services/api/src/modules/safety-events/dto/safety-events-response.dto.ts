import { ApiProperty } from "@nestjs/swagger";
import {
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "../../gps-tracking/gps-tracking.enums";
import type { GeoLineString } from "../../trekking-routes/entities/trekking-route.entity";
import { SafetyEventIngestStatus, SafetyEventRejectionReason } from "../safety-events.enums";

export class RouteDeviationThresholdsDto {
	@ApiProperty({ example: 20, description: "A sample is VALID when accuracy <= this (BR-378)" })
	validSampleMaxAccuracyMeters!: number;

	@ApiProperty({ example: 50, description: "OFF_ROUTE when distance > this (BR-375)" })
	offRouteMinDistanceMeters!: number;

	@ApiProperty({ example: 20, description: "Recovery when distance < this (BR-382)" })
	onRouteMaxDistanceMeters!: number;

	@ApiProperty({ example: 3, description: "Consecutive VALID samples to confirm (BR-377, BR-383)" })
	consecutiveSamples!: number;

	@ApiProperty({
		example: 120,
		description: "GPS_DEGRADED after no VALID sample this long (BR-387)",
	})
	gpsDegradedAfterSeconds!: number;
}

export class RouteDeviationContextResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ description: "Whether the caller may run route-deviation detection right now" })
	eligible!: boolean;

	@ApiProperty({ enum: GpsTrackingIneligibleReason, nullable: true })
	reason!: GpsTrackingIneligibleReason | null;

	@ApiProperty({ enum: GpsParticipantRole })
	participantRole!: GpsParticipantRole;

	@ApiProperty({ format: "uuid", description: "The Trip's authoritative Route" })
	routeId!: string;

	@ApiProperty({
		description: "Fingerprint of the Route geometry; send it back with every safety event",
	})
	routeVersion!: string;

	@ApiProperty({
		description: "GeoJSON LineString used to compute distance_to_route on the device",
		example: {
			type: "LineString",
			coordinates: [
				[108.2, 16.05],
				[108.21, 16.06],
			],
		},
	})
	geometry!: GeoLineString;

	@ApiProperty({ type: RouteDeviationThresholdsDto })
	thresholds!: RouteDeviationThresholdsDto;

	@ApiProperty({ example: "v3" })
	configVersion!: string;
}

export class SafetyEventIngestResultDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ enum: SafetyEventIngestStatus })
	status!: SafetyEventIngestStatus;

	@ApiProperty({ enum: SafetyEventRejectionReason, nullable: true })
	reason!: SafetyEventRejectionReason | null;
}

export class SafetyEventIngestResponseDto {
	@ApiProperty({ type: SafetyEventIngestResultDto, isArray: true })
	results!: SafetyEventIngestResultDto[];
}
