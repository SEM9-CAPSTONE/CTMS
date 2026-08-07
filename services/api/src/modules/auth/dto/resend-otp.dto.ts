import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class ResendOtpDto {
	/** Assumption (Decision Gate v2 #5): identify the account by the `id` already returned by POST /auth/register. */
	@ApiProperty({ format: "uuid" })
	@IsNotEmpty()
	@IsUUID("4")
	userId!: string;
}
