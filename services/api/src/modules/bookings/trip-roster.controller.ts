import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { TripRosterResponseDto } from "./dto/trip-roster-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripRosterService } from "./trip-roster.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("booking-members")
@ApiBearerAuth()
@Controller("trips/:tripId/members")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripRosterController {
	constructor(private readonly service: TripRosterService) {}

	@Get()
	@Roles(UserRole.HOST, UserRole.PORTER)
	@ApiOperation({ summary: "Read the operational Booking member roster for a Trip" })
	@ApiResponse({ status: 200, type: TripRosterResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Owning Host or assigned Porter scope required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 422, description: "Malformed Trip identifier" })
	getRoster(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string
	): Promise<TripRosterResponseDto> {
		return this.service.getRoster(request.user, tripId);
	}
}
