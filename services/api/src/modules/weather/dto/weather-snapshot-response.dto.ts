import { ApiProperty } from "@nestjs/swagger";
import { WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";

/**
 * CTMS-25-T01. Deliberately excludes `providerResponse` (raw provider
 * payload) and `providerWeatherCode` -- internal fields kept for
 * audit/debugging and future rule-tuning (CTMS-26/CTMS-30), not part of
 * this story's API contract (BR-065 only requires rain/wind/temperature/
 * visibility/thunderstorm/timestamp to be exposed).
 */
export class WeatherSnapshotResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty({ enum: WeatherSnapshotStatus })
	status!: WeatherSnapshotStatus;

	@ApiProperty({ type: String, format: "date-time", nullable: true })
	observedAt!: Date | null;

	@ApiProperty({ type: Number, nullable: true })
	rainfallMm!: number | null;

	@ApiProperty({ type: Number, nullable: true })
	windKph!: number | null;

	@ApiProperty({ type: Number, nullable: true })
	temperatureC!: number | null;

	@ApiProperty({ type: Number, nullable: true })
	visibilityM!: number | null;

	@ApiProperty({ type: Boolean, nullable: true })
	thunderstorm!: boolean | null;

	@ApiProperty({ type: String, nullable: true })
	errorMessage!: string | null;

	@ApiProperty({ format: "date-time" })
	createdAt!: Date;
}
