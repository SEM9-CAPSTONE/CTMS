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
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingCancellationService } from "./booking-cancellation.service";
import { CancelBookingResponseDto } from "./dto/cancel-booking-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { CancelBookingDto } from "./dto/cancel-booking.dto";

@ApiTags("bookings")
@ApiBearerAuth()
@Controller("bookings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingCancellationController {
	constructor(private readonly cancellationService: BookingCancellationService) {}

	@Patch(":bookingId/cancel")
	@Roles(UserRole.CAMPER)
	@ApiOperation({
		summary: "Cancel the Camper owner's eligible Booking according to its policy snapshot",
	})
	@ApiResponse({ status: 200, type: CancelBookingResponseDto })
	@ApiResponse({ status: 401, description: "Active authenticated account required" })
	@ApiResponse({ status: 403, description: "Camper role and Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	@ApiResponse({
		status: 409,
		description: "Cancellation policy, state, equipment or financial conflict",
	})
	@ApiResponse({ status: 422, description: "Invalid Booking id or cancellation payload" })
	cancel(
		@Req() request: { user: AuthenticatedUser },
		@Param("bookingId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		bookingId: string,
		@Body() dto: CancelBookingDto
	): Promise<CancelBookingResponseDto> {
		return this.cancellationService.cancel(request.user.userId, bookingId, dto);
	}
}
