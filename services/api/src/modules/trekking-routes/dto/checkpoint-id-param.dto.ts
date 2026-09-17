import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CheckpointIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	routeId!: string;

	@ApiProperty({ format: "uuid" })
	@IsUUID()
	checkpointId!: string;
}
