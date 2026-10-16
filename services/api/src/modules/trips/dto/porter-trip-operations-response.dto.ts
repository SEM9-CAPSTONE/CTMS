import { ApiProperty } from "@nestjs/swagger";
import type { BookingMemberStatus } from "../../bookings/booking-member-status.enum";
import type { Checkpoint } from "../../trekking-routes/entities/checkpoint.entity";
import type { RouteDangerZone } from "../../trekking-routes/entities/route-danger-zone.entity";
import type {
	GeoLineString,
	TrekkingRouteStatus,
} from "../../trekking-routes/entities/trekking-route.entity";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { WaypointType } from "../entities/trip-waypoint.entity";
import type { GeoPoint } from "../entities/trip.entity";
import { PorterAssignedTripResponseDto } from "./porter-assigned-trip-response.dto";

export interface PorterOperationalRoute {
	id: string;
	name: string;
	status: TrekkingRouteStatus;
	geometry: GeoLineString;
	updatedAt: string;
	checkpoints: Omit<Checkpoint, "route">[];
	dangerZones: Omit<RouteDangerZone, "route">[];
}

export interface PorterOperationalWaypoint {
	id: string;
	name: string;
	type: WaypointType;
	dayNumber: number;
	sequenceOrder: number;
	plannedAt: string | null;
	durationMinutes: number | null;
	location: GeoPoint;
}

export interface PorterOperationalMember {
	memberId: string;
	displayName: string | null;
	memberStatus: BookingMemberStatus;
}

export interface PorterRecordedWeather {
	status: "success" | "failed";
	observedAt: string | null;
	fetchedAt: string;
	rainfallMm: number | null;
	windKph: number | null;
	temperatureC: number | null;
	visibilityM: number | null;
	thunderstorm: boolean | null;
	riskLevel: RiskLevel | null;
}

export interface PorterOperationalWeather {
	availability: "recorded" | "stale" | "unavailable";
	maxAgeMinutes: number;
	record: PorterRecordedWeather | null;
}

export class PorterTripOperationsResponseDto extends PorterAssignedTripResponseDto {
	@ApiProperty({ enum: ["assigned"] })
	assignmentStatus!: "assigned";

	@ApiProperty({ type: String, format: "date-time" })
	retrievedAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;

	@ApiProperty({ type: String, format: "date-time", nullable: true })
	meetingAt!: Date | null;

	@ApiProperty({ type: Object, nullable: true })
	meetingPoint!: GeoPoint | null;

	@ApiProperty({
		type: String,
		nullable: true,
		description: "Name of the Trip waypoint located at the Trip meeting point, if any.",
	})
	meetingPointName!: string | null;

	@ApiProperty({ type: [Object] })
	waypoints!: PorterOperationalWaypoint[];

	@ApiProperty({ type: Object, nullable: true })
	route!: PorterOperationalRoute | null;

	@ApiProperty({ type: [Object] })
	members!: PorterOperationalMember[];

	@ApiProperty({ type: Object })
	weather!: PorterOperationalWeather;

	@ApiProperty({
		type: Object,
		description: "No offline-package download tracking is implemented yet.",
	})
	offlinePackage!: { status: "unavailable"; downloadedAt: null };
}
