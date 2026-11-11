import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { BookingMemberStatus } from "../booking-member-status.enum";

export const MANUAL_MEMBER_STATUSES = [
	BookingMemberStatus.JOINED,
	BookingMemberStatus.NO_SHOW,
] as const;

export class UpdateBookingMemberStatusDto {
	@ApiProperty({ enum: MANUAL_MEMBER_STATUSES })
	@IsIn(MANUAL_MEMBER_STATUSES)
	status!: BookingMemberStatus.JOINED | BookingMemberStatus.NO_SHOW;
}
