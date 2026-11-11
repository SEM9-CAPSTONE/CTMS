import {
	Body,
	Controller,
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
// biome-ignore lint/style/useImportType: Body validation needs runtime DTO metadata
import { CreateSafetyEventsDto } from "./dto/create-safety-events.dto";
import {
	RouteDeviationContextResponseDto,
	SafetyEventIngestResponseDto,
} from "./dto/safety-events-response.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { SafetyEventsService } from "./safety-events.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("safety-events")
@ApiBearerAuth()
@Controller("trips/:tripId")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Camper/Porter role required, or not a Trip participant" })
@ApiResponse({ status: 404, description: "Trip not found" })
export class SafetyEventsController {
	constructor(private readonly safetyEvents: SafetyEventsService) {}

	@Get("route-deviation/context")
	@ApiOperation({
		summary:
			"Route geometry/version and fixed V3 thresholds for on-device off-route and GPS-degraded detection",
	})
	@ApiResponse({ status: 200, type: RouteDeviationContextResponseDto })
	getRouteDeviationContext(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<RouteDeviationContextResponseDto> {
		return this.safetyEvents.getRouteDeviationContext(request.user.userId, tripId);
	}

	@Post("safety-events")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			"Synchronize OFF_ROUTE / ON_ROUTE_RECOVERED / GPS_DEGRADED / GPS_RESTORED events; repeated UUIDs are idempotent",
	})
	@ApiResponse({ status: 200, type: SafetyEventIngestResponseDto })
	@ApiResponse({ status: 422, description: "Malformed batch or event fields" })
	ingestEvents(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string,
		@Body() dto: CreateSafetyEventsDto
	): Promise<SafetyEventIngestResponseDto> {
		return this.safetyEvents.ingestEvents(request.user.userId, tripId, dto);
	}
}
