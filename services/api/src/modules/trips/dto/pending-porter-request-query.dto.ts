import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class PendingPorterRequestQueryDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	porterId!: string;
}
