import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class PorterRouteIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	routeId!: string;
}

export class PorterQualificationIdParamDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	qualificationId!: string;
}
