import {
	Body,
	Controller,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingMemberStatusService } from "./booking-member-status.service";
import { BookingMemberResponseDto } from "./dto/booking-member-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { UpdateBookingMemberStatusDto } from "./dto/update-booking-member-status.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("booking-members")
@ApiBearerAuth()
@Controller("trips/:tripId/bookings/:bookingId/members")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingMemberStatusController {
	constructor(private readonly service: BookingMemberStatusService) {}

	@Patch(":memberId/status")
	@Roles(UserRole.HOST, UserRole.PORTER)
	@ApiOperation({ summary: "Update a Trip member's operational participation status" })
	@ApiResponse({ status: 200, type: BookingMemberResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host or assigned Porter Trip scope required" })
	@ApiResponse({ status: 404, description: "Nested Trip, Booking, or member not found" })
	@ApiResponse({ status: 409, description: "Trip, Booking, member state, or timing conflict" })
	@ApiResponse({ status: 422, description: "Malformed identifiers or status payload" })
	updateStatus(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Param("bookingId", UUID_PIPE) bookingId: string,
		@Param("memberId", UUID_PIPE) memberId: string,
		@Body() dto: UpdateBookingMemberStatusDto
	): Promise<BookingMemberResponseDto> {
		return this.service.updateStatus(request.user, tripId, bookingId, memberId, dto);
	}
}
