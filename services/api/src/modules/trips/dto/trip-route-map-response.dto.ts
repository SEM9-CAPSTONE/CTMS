import { ApiProperty } from "@nestjs/swagger";
import type { GeoPoint } from "../entities/trip.entity";
import type { PorterOperationalRoute } from "./porter-trip-operations-response.dto";
export class TripRouteMapResponseDto {
	@ApiProperty() tripId!: string;
	@ApiProperty() title!: string;
	@ApiProperty({ type: Object, nullable: true }) meetingPoint!: GeoPoint | null;
	@ApiProperty({ type: Object, nullable: true }) route!: PorterOperationalRoute | null;
}
