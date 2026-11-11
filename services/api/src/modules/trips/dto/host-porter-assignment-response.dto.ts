import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";
import { TripStatus } from "../entities/trip.entity";

export class HostPorterAssignmentDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiPropertyOptional({ nullable: true })
	displayName!: string | null;

	@ApiPropertyOptional({ nullable: true })
	email!: string | null;

	@ApiProperty({ enum: TripPorterStatus })
	status!: TripPorterStatus;

	@ApiPropertyOptional({ nullable: true })
	assignedAt!: Date | null;

	@ApiPropertyOptional({ nullable: true })
	reconfirmationDeadline!: Date | null;

	@ApiPropertyOptional({ nullable: true })
	reconfirmedAt!: Date | null;

	@ApiPropertyOptional({ nullable: true })
	declinedAt!: Date | null;
}

export class HostPorterAssignmentTripDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	title!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty()
	startsAt!: Date;

	@ApiProperty()
	endsAt!: Date;

	@ApiProperty()
	assignedPorterCount!: number;

	@ApiProperty({ type: HostPorterAssignmentDto, isArray: true })
	assignments!: HostPorterAssignmentDto[];
}
