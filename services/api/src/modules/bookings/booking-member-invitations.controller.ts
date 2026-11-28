import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { BookingMemberInvitationsService } from "./booking-member-invitations.service";
import {
	BookingMembersWorkspaceResponseDto,
	// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
	CreateBookingMemberInvitationDto,
	CreateBookingMemberInvitationResponseDto,
	MyPendingBookingInvitationDto,
	PublicBookingInvitationResponseDto,
	RespondBookingInvitationResponseDto,
} from "./dto/booking-member-invitation.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("booking-invitations")
@Controller()
export class BookingMemberInvitationsController {
	constructor(private readonly invitationsService: BookingMemberInvitationsService) {}

	@Get("bookings/:bookingId/invitations")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "List active Booking members and pending invitations for the owner" })
	@ApiResponse({ status: 200, type: BookingMembersWorkspaceResponseDto })
	getWorkspace(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", UUID_PIPE) bookingId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.invitationsService.getWorkspace(request.user.userId, bookingId);
	}

	@Post("bookings/:bookingId/invitations")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Invite a companion by email to join a Booking (requires DiTrek account to accept)",
	})
	@ApiResponse({ status: 201, type: CreateBookingMemberInvitationResponseDto })
	createInvitation(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", UUID_PIPE) bookingId: string,
		@Body() dto: CreateBookingMemberInvitationDto
	): Promise<CreateBookingMemberInvitationResponseDto> {
		return this.invitationsService.createInvitation(request.user.userId, bookingId, dto);
	}

	@Delete("bookings/:bookingId/invitations/:invitationId")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Revoke a pending Booking member invitation" })
	@ApiResponse({ status: 200, type: BookingMembersWorkspaceResponseDto })
	revokeInvitation(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", UUID_PIPE) bookingId: string,
		@Param("invitationId", UUID_PIPE) invitationId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.invitationsService.revokeInvitation(request.user.userId, bookingId, invitationId);
	}

	@Delete("bookings/:bookingId/members/:memberId")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Remove a companion member from a Booking before Trip start" })
	@ApiResponse({ status: 200, type: BookingMembersWorkspaceResponseDto })
	removeMember(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", UUID_PIPE) bookingId: string,
		@Param("memberId", UUID_PIPE) memberId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.invitationsService.removeMember(request.user.userId, bookingId, memberId);
	}

	@Get("booking-invitations/mine")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "List pending Booking invitations sent to the signed-in Camper email" })
	@ApiResponse({ status: 200, type: MyPendingBookingInvitationDto, isArray: true })
	listMine(@Req() request: AuthenticatedRequest): Promise<MyPendingBookingInvitationDto[]> {
		return this.invitationsService.listMyPendingInvitations(request.user.userId);
	}

	@Get("booking-invitations/:token")
	@ApiOperation({ summary: "Preview a Booking invitation by token (public safe summary)" })
	@ApiResponse({ status: 200, type: PublicBookingInvitationResponseDto })
	getPublicInvitation(@Param("token") token: string): Promise<PublicBookingInvitationResponseDto> {
		return this.invitationsService.getPublicInvitation(token);
	}

	@Post("booking-invitations/:token/accept")
	@HttpCode(HttpStatus.OK)
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Accept a pending Booking invitation as the invited DiTrek Camper" })
	@ApiResponse({ status: 200, type: RespondBookingInvitationResponseDto })
	acceptInvitation(
		@Req() request: AuthenticatedRequest,
		@Param("token") token: string
	): Promise<RespondBookingInvitationResponseDto> {
		return this.invitationsService.acceptInvitation(request.user.userId, token);
	}

	@Post("booking-invitations/:token/decline")
	@HttpCode(HttpStatus.OK)
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.CAMPER)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Decline a pending Booking invitation as the invited DiTrek Camper" })
	@ApiResponse({ status: 200, type: RespondBookingInvitationResponseDto })
	declineInvitation(
		@Req() request: AuthenticatedRequest,
		@Param("token") token: string
	): Promise<RespondBookingInvitationResponseDto> {
		return this.invitationsService.declineInvitation(request.user.userId, token);
	}
}
