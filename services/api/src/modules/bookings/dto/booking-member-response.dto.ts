import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingMemberStatus } from "../booking-member-status.enum";

export class BookingMemberResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	checkedInAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	noShowAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	leftAt!: Date | null;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	statusUpdatedBy!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}
