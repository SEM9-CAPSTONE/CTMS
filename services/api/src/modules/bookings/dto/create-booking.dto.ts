import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateBookingDto {
	@ApiProperty({ format: "uuid", description: "Published Trip to book" })
	@IsUUID()
	tripId!: string;

	@ApiProperty({ minimum: 1, description: "Number of Trip seats to reserve" })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	numPeople!: number;

	@ApiPropertyOptional({
		default: false,
		description:
			"Optional Camper consent to share Health Profile for safety support on this booking",
	})
	@IsOptional()
	@IsBoolean()
	healthProfileConsent?: boolean;
}
