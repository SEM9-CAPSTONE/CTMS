import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsISO8601,
	IsNumber,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from "class-validator";
import {
	CHECKPOINT_ARRIVAL_BATCH_SIZE,
	CHECKPOINT_ARRIVAL_SAMPLE_COUNT,
	CheckpointArrivalRejection,
	CheckpointArrivalSyncStatus,
} from "./checkpoint-arrivals.types";

export class CheckpointGpsSampleDto {
	@ApiProperty({ description: "Original GPS timestamp with explicit timezone" })
	@IsISO8601({ strict: true })
	@Matches(/(Z|[+-]\d{2}:\d{2})$/)
	eventTime!: string;

	@ApiProperty({ minimum: -90, maximum: 90 })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ minimum: -180, maximum: 180 })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-180)
	@Max(180)
	longitude!: number;

	@ApiProperty({ minimum: 0 })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	accuracyMeters!: number;
}

export class CheckpointArrivalInputDto {
	@ApiProperty({ format: "uuid", description: "Stable client event/visit identity" })
	@IsUUID()
	id!: string;

	@ApiProperty({ format: "uuid" })
	@IsUUID()
	checkpointId!: string;

	@ApiProperty({ format: "uuid" })
	@IsUUID()
	routeId!: string;

	@ApiProperty({ maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	routeVersion!: string;

	@ApiProperty({ format: "uuid" })
	@IsUUID()
	packageId!: string;

	@ApiProperty({ maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	packageVersion!: string;

	@ApiProperty()
	@IsBoolean()
	detectedOffline!: boolean;

	@ApiProperty({
		type: CheckpointGpsSampleDto,
		isArray: true,
		description:
			"The final three consecutive raw samples; event time/location are the third sample",
	})
	@IsArray()
	@ArrayMinSize(CHECKPOINT_ARRIVAL_SAMPLE_COUNT)
	@ArrayMaxSize(CHECKPOINT_ARRIVAL_SAMPLE_COUNT)
	@ValidateNested({ each: true })
	@Type(() => CheckpointGpsSampleDto)
	samples!: CheckpointGpsSampleDto[];
}

export class SyncAutomaticCheckpointArrivalsDto {
	@ApiProperty({
		type: CheckpointArrivalInputDto,
		isArray: true,
		maxItems: CHECKPOINT_ARRIVAL_BATCH_SIZE,
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(CHECKPOINT_ARRIVAL_BATCH_SIZE)
	@ValidateNested({ each: true })
	@Type(() => CheckpointArrivalInputDto)
	arrivals!: CheckpointArrivalInputDto[];
}

export class CheckpointArrivalResultDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid", description: "Mirrors client-provided event UUID" })
	clientId!: string;

	@ApiProperty({ enum: CheckpointArrivalSyncStatus })
	status!: CheckpointArrivalSyncStatus;

	@ApiProperty({
		enum: CheckpointArrivalRejection,
		nullable: true,
		description: "Per-record rejection code",
	})
	reason!: CheckpointArrivalRejection | null;

	@ApiProperty({
		type: Boolean,
		description: "Whether this rejection can be retried without changing payload",
	})
	retryable!: boolean;

	@ApiProperty({ type: String, format: "uuid", nullable: true })
	visitId!: string | null;

	@ApiProperty({
		type: String,
		format: "date-time",
		nullable: true,
		description: "First server receipt; null for rejected/device-only events",
	})
	receivedAt!: Date | null;
}

export class CheckpointArrivalSyncResponseDto {
	@ApiProperty({ type: CheckpointArrivalResultDto, isArray: true })
	results!: CheckpointArrivalResultDto[];
}
