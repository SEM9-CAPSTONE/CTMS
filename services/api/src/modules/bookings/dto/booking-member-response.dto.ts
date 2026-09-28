import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingMemberStatus } from "../booking-member-status.enum";

export class BookingMemberResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}
