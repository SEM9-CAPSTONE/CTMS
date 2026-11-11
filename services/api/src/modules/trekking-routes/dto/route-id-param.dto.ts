import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class RouteIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	routeId!: string;
}
