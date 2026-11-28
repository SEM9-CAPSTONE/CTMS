import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { normalizeEmail } from "../../../shared/utils/normalize.util";
import { BookingMemberStatus } from "../booking-member-status.enum";
import { BookingMemberInvitationStatus } from "../entities/booking-member-invitation.entity";

export class CreateBookingMemberInvitationDto {
	@ApiProperty({ example: "friend@example.com", maxLength: 254 })
	@Transform(({ value }) => (typeof value === "string" ? normalizeEmail(value) : value))
	@IsString()
	@IsNotEmpty()
	@IsEmail()
	@MaxLength(254)
	email!: string;
}

export class BookingInvitationItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ example: "friend@example.com" })
	invitedEmail!: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	invitedUserFullName!: string | null;

	@ApiProperty({
		description: "Whether the invited email already belongs to an active DiTrek user",
	})
	hasAccount!: boolean;

	@ApiProperty({ enum: BookingMemberInvitationStatus })
	status!: BookingMemberInvitationStatus;

	@ApiProperty({ description: "Shareable invitation token" })
	token!: string;

	@ApiProperty({ example: "/invitations/abc123" })
	invitePath!: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	inviteUrl!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	expiresAt!: string;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	respondedAt!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: string;
}

export class BookingRosterMemberItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	email!: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	fullName!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: string;
}

export class BookingMembersWorkspaceResponseDto {
	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ minimum: 1 })
	numPeople!: number;

	@ApiProperty()
	activeMemberCount!: number;

	@ApiProperty()
	pendingInvitationCount!: number;

	@ApiProperty()
	remainingSlots!: number;

	@ApiProperty()
	canManage!: boolean;

	@ApiProperty({ type: BookingRosterMemberItemDto, isArray: true })
	members!: BookingRosterMemberItemDto[];

	@ApiProperty({ type: BookingInvitationItemDto, isArray: true })
	invitations!: BookingInvitationItemDto[];
}

export class CreateBookingMemberInvitationResponseDto {
	@ApiProperty({ type: BookingInvitationItemDto })
	invitation!: BookingInvitationItemDto;

	@ApiProperty()
	emailSent!: boolean;

	@ApiProperty({ type: BookingMembersWorkspaceResponseDto })
	workspace!: BookingMembersWorkspaceResponseDto;
}

export class PublicBookingInvitationResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	tripTitle!: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	routeName!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	tripStartsAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	tripEndsAt!: string;

	@ApiProperty()
	inviterName!: string;

	@ApiProperty({ example: "friend@example.com" })
	invitedEmail!: string;

	@ApiProperty()
	hasAccount!: boolean;

	@ApiProperty({ enum: BookingMemberInvitationStatus })
	status!: BookingMemberInvitationStatus;

	@ApiProperty()
	canRespond!: boolean;

	@ApiPropertyOptional({ type: String, nullable: true })
	unavailableReason!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	expiresAt!: string;
}

export class MyPendingBookingInvitationDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	token!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	tripTitle!: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	routeName!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	tripStartsAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	tripEndsAt!: string;

	@ApiProperty()
	inviterName!: string;

	@ApiProperty({ example: "friend@example.com" })
	invitedEmail!: string;

	@ApiProperty({ type: String, format: "date-time" })
	expiresAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: string;
}

export class RespondBookingInvitationResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: BookingMemberInvitationStatus })
	status!: BookingMemberInvitationStatus;
}
