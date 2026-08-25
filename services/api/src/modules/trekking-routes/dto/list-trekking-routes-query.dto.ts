import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ListTrekkingRoutesQueryDto {
	@ApiProperty({ format: "uuid", description: "Owned campsite whose routes should be returned" })
	@IsUUID()
	campsiteId!: string;
}
