import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsUUID, ValidateNested } from "class-validator";
import { ConfirmCheckpointArrivalDto } from "./confirm-checkpoint-arrival.dto";

export class SyncCheckpointArrivalItemDto extends ConfirmCheckpointArrivalDto {
	@ApiProperty({
		description: "Checkpoint UUID on the Route",
		type: String,
		format: "uuid",
	})
	@IsUUID("4")
	checkpointId!: string;
}

export class SyncCheckpointArrivalsDto {
	@ApiProperty({
		description: "List of offline checkpoint arrival events to synchronize",
		type: [SyncCheckpointArrivalItemDto],
	})
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => SyncCheckpointArrivalItemDto)
	arrivals!: SyncCheckpointArrivalItemDto[];
}
