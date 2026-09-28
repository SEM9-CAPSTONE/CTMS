import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsUUID, Min } from "class-validator";

export class CreateBookingDto {
	@ApiProperty({ format: "uuid", description: "Published Trip to book" })
	@IsUUID()
	tripId!: string;

	@ApiProperty({ minimum: 1, description: "Number of Trip seats to reserve" })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	numPeople!: number;
}
