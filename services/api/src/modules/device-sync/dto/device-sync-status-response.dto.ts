import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MemberSyncHealthDto {
	@ApiProperty({ example: "a0000000-0000-0000-0000-000000000001" })
	userId!: string;

	@ApiProperty({ example: "Nguyen Van A" })
	displayName!: string;

	@ApiProperty({ example: "camper", enum: ["camper", "porter"] })
	role!: string;

	@ApiProperty({ example: 42 })
	gpsCount!: number;

	@ApiProperty({ example: 1 })
	safetyCount!: number;

	@ApiPropertyOptional({ example: "2026-10-23T15:30:00.000Z", nullable: true })
	lastReceivedAt!: string | null;

	@ApiProperty({ example: "connected", enum: ["connected", "syncing", "stale"] })
	status!: "connected" | "syncing" | "stale";
}

export class DeviceSyncStatusResponseDto {
	@ApiProperty({ example: "t0000000-0000-0000-0000-000000000001" })
	tripId!: string;

	@ApiProperty({ example: "u0000000-0000-0000-0000-000000000001" })
	userId!: string;

	@ApiProperty({ example: "porter", enum: ["camper", "porter", "host"] })
	participantRole!: string;

	@ApiProperty({
		description: "Total server-confirmed GPS logs accepted for this user and Trip (BR-226)",
		example: 120,
	})
	serverConfirmedGpsCount!: number;

	@ApiProperty({
		description: "Total server-confirmed safety events/incidents accepted for this user and Trip",
		example: 2,
	})
	serverConfirmedSafetyCount!: number;

	@ApiPropertyOptional({
		description: "Latest received_at timestamp across GPS logs and safety events on the server",
		example: "2026-10-23T15:30:00.000Z",
		nullable: true,
	})
	lastReceivedAt!: string | null;

	@ApiPropertyOptional({
		description: "Active offline package version recorded with the latest synchronized log",
		example: "pkg-trip-123-v2",
		nullable: true,
	})
	packageVersion!: string | null;

	@ApiProperty({
		description: "Tracking config version",
		example: "v3",
	})
	configVersion!: string;

	@ApiPropertyOptional({
		description: "Member synchronization health summary (available for Host role)",
		type: [MemberSyncHealthDto],
	})
	membersSyncHealth?: MemberSyncHealthDto[];
}
