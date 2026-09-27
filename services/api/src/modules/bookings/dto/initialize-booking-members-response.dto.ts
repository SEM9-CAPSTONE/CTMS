import { ApiProperty } from "@nestjs/swagger";
import { BookingMemberResponseDto } from "./booking-member-response.dto";

export class InitializeBookingMembersResponseDto {
	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ type: BookingMemberResponseDto, isArray: true })
	members!: BookingMemberResponseDto[];
}
