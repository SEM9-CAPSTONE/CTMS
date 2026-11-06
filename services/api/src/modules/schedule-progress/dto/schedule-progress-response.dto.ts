import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BehindScheduleLevel, ScheduleStatus } from "../schedule-progress.evaluator";

export class ScheduleReferenceDto {
	@ApiProperty({ description: "Earliest Porter-confirmed Checkpoint the Camper has not passed" })
	checkpointId!: string;

	@ApiProperty()
	checkpointName!: string;

	@ApiProperty({ description: "T(X): when the Porter confirmed arrival at this Checkpoint" })
	porterArrivedAt!: string;
}

export class SafeCheckpointDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ example: "rest" })
	type!: string;
}

export class CamperScheduleProgressDto {
	@ApiProperty()
	userId!: string;

	@ApiPropertyOptional({ nullable: true })
	fullName!: string | null;

	@ApiProperty({ enum: ScheduleStatus })
	status!: ScheduleStatus;

	@ApiPropertyOptional({ type: ScheduleReferenceDto, nullable: true })
	reference!: ScheduleReferenceDto | null;

	@ApiPropertyOptional({ nullable: true, description: "now − T(X) in whole minutes" })
	lagMinutes!: number | null;

	@ApiPropertyOptional({
		type: SafeCheckpointDto,
		nullable: true,
		description: "null when no safe Checkpoint exists; guidance then carries the fallback text",
	})
	safeCheckpoint!: SafeCheckpointDto | null;

	@ApiPropertyOptional({ nullable: true })
	guidance!: string | null;

	@ApiPropertyOptional({ nullable: true })
	lastValidSampleAt!: string | null;

	@ApiProperty({ enum: BehindScheduleLevel, isArray: true })
	levelsReached!: BehindScheduleLevel[];
}

export class ScheduleThresholdsDto {
	@ApiProperty({ example: 30 })
	behindLagMinutes!: number;

	@ApiProperty({ example: 60 })
	severelyBehindLagMinutes!: number;

	@ApiProperty({ example: 5 })
	locationUnknownAfterMinutes!: number;
}

export class ScheduleProgressResponseDto {
	@ApiProperty()
	tripId!: string;

	@ApiProperty({ example: "ongoing" })
	tripStatus!: string;

	@ApiProperty()
	evaluatedAt!: string;

	@ApiProperty({ enum: ["camper", "team"] })
	viewer!: "camper" | "team";

	@ApiProperty({ example: "v3" })
	configVersion!: string;

	@ApiProperty({ type: ScheduleThresholdsDto })
	thresholds!: ScheduleThresholdsDto;

	@ApiProperty({ type: CamperScheduleProgressDto, isArray: true })
	members!: CamperScheduleProgressDto[];
}
