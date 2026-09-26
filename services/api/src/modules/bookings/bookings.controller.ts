import { Body, Controller, Headers, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsService } from "./bookings.service";
import { BookingResponseDto } from "./dto/booking-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateBookingDto } from "./dto/create-booking.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("bookings")
@ApiBearerAuth()
@Controller("bookings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
	constructor(private readonly bookingsService: BookingsService) {}

	@Post()
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Create a Booking for an eligible published Trip" })
	@ApiHeader({
		name: "Idempotency-Key",
		required: true,
		description: "Stable key for one booking attempt",
	})
	@ApiResponse({ status: 201, type: BookingResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Camper role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip or idempotency conflict" })
	@ApiResponse({ status: 422, description: "Invalid payload or Idempotency-Key" })
	create(
		@Req() request: AuthenticatedRequest,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: CreateBookingDto
	): Promise<BookingResponseDto> {
		return this.bookingsService.create(request.user.userId, idempotencyKey, dto);
	}
}
