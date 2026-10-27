import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { SosAlert } from "../entities/sos-alert.entity";
import { EmergencyType, SosStatus } from "../sos.enums";

export class SosLocationResponseDto {
	@ApiProperty({ example: 16.0544 })
	latitude!: number;

	@ApiProperty({ example: 108.2022 })
	longitude!: number;
}

export class SosAlertResponseDto {
	@ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
	id!: string;

	@ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
	tripId!: string;

	@ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
	senderId!: string;

	@ApiProperty({ enum: EmergencyType, example: EmergencyType.MEDICAL })
	emergencyType!: EmergencyType;

	@ApiPropertyOptional({ type: SosLocationResponseDto, nullable: true })
	location!: SosLocationResponseDto | null;

	@ApiPropertyOptional({ example: 85, nullable: true })
	batteryLevel!: number | null;

	@ApiProperty({ example: "2026-10-27T10:00:00.000Z" })
	eventTime!: string;

	@ApiProperty({ enum: SosStatus, example: SosStatus.CANCELLED })
	status!: SosStatus;

	@ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174002", nullable: true })
	cancelledBy!: string | null;

	@ApiPropertyOptional({ example: "2026-10-27T10:02:00.000Z", nullable: true })
	cancelledAt!: string | null;

	@ApiPropertyOptional({ example: "Accidentally pressed while hiking", nullable: true })
	cancellationReason!: string | null;

	@ApiPropertyOptional({ example: null, nullable: true })
	acknowledgedBy!: string | null;

	@ApiPropertyOptional({ example: null, nullable: true })
	acknowledgedAt!: string | null;

	@ApiPropertyOptional({ example: null, nullable: true })
	closedBy!: string | null;

	@ApiPropertyOptional({ example: null, nullable: true })
	closedAt!: string | null;

	@ApiPropertyOptional({ example: null, nullable: true })
	resolutionNote!: string | null;

	@ApiProperty({ example: "2026-10-27T10:00:01.000Z" })
	receivedAt!: string;

	@ApiProperty({ example: "2026-10-27T10:00:01.000Z" })
	createdAt!: string;

	@ApiProperty({ example: "2026-10-27T10:02:00.000Z" })
	updatedAt!: string;
}

export function toSosAlertResponseDto(alert: SosAlert): SosAlertResponseDto {
	const receivedAt = alert.receivedAt ?? new Date();
	const createdAt = alert.createdAt ?? receivedAt;
	const updatedAt = alert.updatedAt ?? receivedAt;

	return {
		id: alert.id,
		tripId: alert.tripId,
		senderId: alert.senderId,
		emergencyType: alert.emergencyType,
		location: alert.location
			? {
					latitude: alert.location.coordinates[1],
					longitude: alert.location.coordinates[0],
				}
			: null,
		batteryLevel: alert.batteryLevel ?? null,
		eventTime: alert.eventTime.toISOString(),
		status: alert.status,
		cancelledBy: alert.cancelledBy ?? null,
		cancelledAt: alert.cancelledAt ? alert.cancelledAt.toISOString() : null,
		cancellationReason: alert.cancellationReason ?? null,
		acknowledgedBy: alert.acknowledgedBy ?? null,
		acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
		closedBy: alert.closedBy ?? null,
		closedAt: alert.closedAt ? alert.closedAt.toISOString() : null,
		resolutionNote: alert.resolutionNote ?? null,
		receivedAt: receivedAt.toISOString(),
		createdAt: createdAt.toISOString(),
		updatedAt: updatedAt.toISOString(),
	};
}
