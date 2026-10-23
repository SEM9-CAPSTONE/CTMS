import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CancelBookingDto {
	@ApiProperty({ maxLength: 255, description: "Camper cancellation reason" })
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	reason!: string;
}
