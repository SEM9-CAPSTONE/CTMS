import { ApiProperty } from "@nestjs/swagger";
import { TripStatus } from "../entities/trip.entity";

export class PorterAssignedTripResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	title!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty({ type: String, format: "date-time" })
	startsAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	endsAt!: Date;
}
