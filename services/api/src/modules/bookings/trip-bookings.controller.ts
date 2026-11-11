import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { TripBookingsResponseDto } from "./dto/trip-bookings-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripBookingsService } from "./trip-bookings.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("trip-bookings")
@ApiBearerAuth()
@Controller("trips/:tripId/bookings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripBookingsController {
	constructor(private readonly service: TripBookingsService) {}

	@Get()
	@Roles(UserRole.HOST, UserRole.PORTER, UserRole.ADMIN)
	@ApiOperation({ summary: "Read Bookings and hired equipment for a Trip" })
	@ApiResponse({ status: 200, type: TripBookingsResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Owning Host or Admin required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 422, description: "Malformed Trip identifier" })
	getBookings(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string
	): Promise<TripBookingsResponseDto> {
		return this.service.getBookings(request.user, tripId);
	}
}
