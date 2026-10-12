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
import { CreateGpsLogsDto } from "./dto/create-gps-logs.dto";
import {
	GpsLogIngestResponseDto,
	GpsTrackingContextResponseDto,
} from "./dto/gps-tracking-response.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { GpsTrackingService } from "./gps-tracking.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("gps-tracking")
@ApiBearerAuth()
@Controller("trips/:tripId")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Camper/Porter role required, or not a Trip participant" })
@ApiResponse({ status: 404, description: "Trip not found" })
export class GpsTrackingController {
	constructor(private readonly gpsTracking: GpsTrackingService) {}

	@Get("gps-tracking/context")
	@ApiOperation({
		summary: "Whether the caller may record GPS breadcrumbs now, with the fixed V3 intervals",
	})
	@ApiResponse({ status: 200, type: GpsTrackingContextResponseDto })
	getContext(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<GpsTrackingContextResponseDto> {
		return this.gpsTracking.getTrackingContext(request.user.userId, tripId);
	}

	@Post("gps-logs")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Synchronize captured GPS breadcrumbs; repeated UUIDs are accepted idempotently",
	})
	@ApiResponse({ status: 200, type: GpsLogIngestResponseDto })
	@ApiResponse({ status: 422, description: "Malformed batch or log fields" })
	ingestLogs(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string,
		@Body() dto: CreateGpsLogsDto
	): Promise<GpsLogIngestResponseDto> {
		return this.gpsTracking.ingestLogs(request.user.userId, tripId, dto);
	}
}
