import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { TripIdParamDto } from "./trip-id-param.dto";

export class CheckpointArrivalParamDto extends TripIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID("4")
	checkpointId!: string;
}
