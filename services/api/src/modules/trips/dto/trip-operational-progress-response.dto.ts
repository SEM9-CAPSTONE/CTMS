import { ApiProperty } from "@nestjs/swagger";
import { CheckpointType } from "../../trekking-routes/entities/checkpoint.entity";
import { TripStatus } from "../entities/trip.entity";

export type CheckpointArrivalStatus = "not_visited" | "arrival_confirmed";

export class MemberCheckpointVisitDto {
	@ApiProperty({ type: String, format: "uuid" })
	memberId!: string;

	@ApiProperty({ type: String, format: "uuid", nullable: true })
	userId!: string | null;

	@ApiProperty({ type: String, nullable: true })
	displayName!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	arrivedAt!: string;

	@ApiProperty({ type: Boolean })
	capturedOffline!: boolean;
}

export class CheckpointProgressItemDto {
	@ApiProperty({ type: String, format: "uuid" })
	checkpointId!: string;

	@ApiProperty({ type: String })
	name!: string;

	@ApiProperty({ enum: CheckpointType })
	type!: CheckpointType;

	@ApiProperty({ type: Number })
	routePosition!: number;

	@ApiProperty({ type: Number })
	radiusMeters!: number;

	@ApiProperty({ enum: ["not_visited", "arrival_confirmed"] })
	status!: CheckpointArrivalStatus;

	@ApiProperty({ type: String, format: "date-time", nullable: true })
	arrivedAt!: string | null;

	@ApiProperty({ type: String, format: "uuid", nullable: true })
	confirmedById!: string | null;

	@ApiProperty({ type: Number })
	visitedMembersCount!: number;

	@ApiProperty({ type: Number })
	totalJoinedMembersCount!: number;

	@ApiProperty({ type: [MemberCheckpointVisitDto] })
	visits!: MemberCheckpointVisitDto[];
}

export class LastVisitedCheckpointDto {
	@ApiProperty({ type: String, format: "uuid" })
	checkpointId!: string;

	@ApiProperty({ type: String })
	name!: string;

	@ApiProperty({ type: String, format: "date-time" })
	arrivedAt!: string;

	@ApiProperty({ type: String, format: "uuid" })
	confirmedById!: string;
}

export class TripOperationalProgressResponseDto {
	@ApiProperty({ type: String, format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty({ type: Number })
	totalCheckpoints!: number;

	@ApiProperty({ type: Number })
	visitedCheckpoints!: number;

	@ApiProperty({ type: Number })
	progressPercentage!: number;

	@ApiProperty({ type: LastVisitedCheckpointDto, nullable: true })
	lastVisitedCheckpoint!: LastVisitedCheckpointDto | null;

	@ApiProperty({ type: [CheckpointProgressItemDto] })
	checkpoints!: CheckpointProgressItemDto[];
}
