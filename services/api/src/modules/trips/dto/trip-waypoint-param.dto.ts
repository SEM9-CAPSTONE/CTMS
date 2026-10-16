import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { TripIdParamDto } from "./trip-id-param.dto";

export class TripWaypointParamDto extends TripIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	waypointId!: string;
}
