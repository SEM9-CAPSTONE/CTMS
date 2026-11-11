import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingStatus } from "../../profiles/entities/booking.entity";
import { TripStatus } from "../../trips/entities/trip.entity";
import { BookingMemberStatus } from "../booking-member-status.enum";

export class TripRosterMemberResponseDto {
	@ApiProperty({ format: "uuid" })
	memberId!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiPropertyOptional({ nullable: true })
	displayName!: string | null;

	@ApiPropertyOptional({ nullable: true })
	email!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;

	@ApiProperty({ enum: BookingStatus, nullable: true })
	bookingStatus!: BookingStatus | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	checkedInAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	noShowAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	leftAt!: Date | null;
}

export class TripRosterResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty({ type: String, format: "date-time" })
	startsAt!: Date;

	@ApiProperty({ type: TripRosterMemberResponseDto, isArray: true })
	members!: TripRosterMemberResponseDto[];
}
