import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class TripIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	tripId!: string;
}
