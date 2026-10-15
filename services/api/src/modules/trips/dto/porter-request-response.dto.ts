import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";
import { PorterRequestStatus } from "../entities/porter-request.entity";
import { TripStatus } from "../entities/trip.entity";
import { IntendedPorterRole } from "./available-porters-query.dto";

export class PorterRequestTripSummaryDto {
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

	@ApiPropertyOptional({ nullable: true })
	meetingAt!: Date | null;
}

export class PorterRequestAssignmentDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ enum: TripPorterStatus })
	status!: TripPorterStatus;
}

export class PorterRequestResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ format: "uuid" })
	requestedBy!: string;

	@ApiProperty({ enum: IntendedPorterRole })
	requestedRole!: IntendedPorterRole;

	@ApiPropertyOptional({ nullable: true })
	note!: string | null;

	@ApiProperty({ enum: PorterRequestStatus })
	status!: PorterRequestStatus;

	@ApiProperty()
	expiresAt!: Date;

	@ApiPropertyOptional({ nullable: true })
	respondedAt!: Date | null;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;

	@ApiPropertyOptional({ type: PorterRequestTripSummaryDto, nullable: true })
	trip?: PorterRequestTripSummaryDto | null;

	@ApiPropertyOptional({ type: PorterRequestAssignmentDto, nullable: true })
	assignment?: PorterRequestAssignmentDto | null;
}
