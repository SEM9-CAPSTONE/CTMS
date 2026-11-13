import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the query
import { ListRouteDeviationEventsQueryDto } from "./dto/route-deviation-analysis.dto";
import type {
	RouteDeviationEventRow,
	TripAnalysisRow,
} from "./route-deviation-analysis.repository";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { RouteDeviationAnalysisService } from "./route-deviation-analysis.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

/** CTMS-115: historical route deviation analysis (Admin = authorized safety/audit user). */
@ApiTags("route-deviation-analysis")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class RouteDeviationAnalysisController {
	constructor(private readonly analysisService: RouteDeviationAnalysisService) {}

	@Post("route-deviation-analysis/trips/:tripId/run")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Analyse (or re-analyse) one completed Trip's GPS history into deviation episodes",
		description:
			"Replays the Trip's stored GPS logs with the fixed V3 rules and replaces this Trip's episodes for the current analysis version (idempotent). Raw evidence is not modified.",
	})
	@ApiResponse({ status: 200, description: "Analysis stored" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip is not completed" })
	runForTrip(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", ID_PIPE) tripId: string
	): Promise<TripAnalysisRow> {
		return this.analysisService.runForTrip(tripId, request.user.userId);
	}

	@Get("route-deviation-analysis/trips/:tripId")
	@ApiOperation({ summary: "The Trip's analysis summary and its deviation episodes" })
	@ApiResponse({ status: 404, description: "Not analysed yet" })
	getTripAnalysis(
		@Param("tripId", ID_PIPE) tripId: string
	): Promise<{ analysis: TripAnalysisRow; events: RouteDeviationEventRow[] }> {
		return this.analysisService.getTripAnalysis(tripId);
	}

	@Get("route-deviation-events")
	@ApiOperation({ summary: "List historical Route Deviation Events, newest first" })
	listEvents(@Query() query: ListRouteDeviationEventsQueryDto): Promise<RouteDeviationEventRow[]> {
		return this.analysisService.listEvents(query);
	}
}
