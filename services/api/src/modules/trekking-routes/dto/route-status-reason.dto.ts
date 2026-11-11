import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class RouteStatusReasonDto {
	@ApiProperty({
		maxLength: 255,
		description: "Operational reason for the route lifecycle transition",
	})
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	reason!: string;
}
