import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { TripIdParamDto } from "./trip-id-param.dto";

export class TripPorterRequestParamDto extends TripIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	requestId!: string;
}
