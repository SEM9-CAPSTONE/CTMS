import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import type { GetRouteSafetyOverviewQueryDto } from "./dtos/get-route-safety-overview-query.dto";
import type { GetTripFeedbackOverviewQueryDto } from "./dtos/get-trip-feedback-overview-query.dto";
import { RouteSafetyOverviewResponseDto } from "./dtos/route-safety-overview-response.dto";
import { TripFeedbackOverviewResponseDto } from "./dtos/trip-feedback-overview-response.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { TripReviewAnalyticsHostService } from "./trip-review-analytics-host.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("host-review-analytics")
@ApiBearerAuth()
@Controller("host/review-analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class TripReviewAnalyticsHostController {
	constructor(private readonly analyticsService: TripReviewAnalyticsHostService) {}

	@Get("trips-overview")
	@ApiOperation({
		summary: "Trip feedback overview aggregating aspect sentiments for host-owned trips",
		description:
			"Aggregates safety, guide_support, equipment, and value sentiments from target='trip' reviews. Activates rankings/scores only when totalReviews >= 5.",
	})
	@ApiResponse({
		status: 200,
		type: TripFeedbackOverviewResponseDto,
		description: "Returns feedback overview with aspect sentiment breakdown per trip",
	})
	async getTripsFeedback(
		@Req() req: AuthenticatedRequest,
		@Query() query: GetTripFeedbackOverviewQueryDto
	): Promise<TripFeedbackOverviewResponseDto> {
		return this.analyticsService.getTripsFeedbackOverview(req.user.userId, query);
	}

	@Get("routes-safety-overview")
	@ApiOperation({
		summary: "Route safety overview aggregating incident signals for host trips",
		description:
			"Aggregates fall_slip, injury, lost_path, weather_hazard, and other signals. All metrics use COUNT(DISTINCT review_id). Activates ranking only when totalReviews >= 10. Does NOT constitute safety hotspots.",
	})
	@ApiResponse({
		status: 200,
		type: RouteSafetyOverviewResponseDto,
		description: "Returns route safety overview with incident breakdown per trekking route",
	})
	async getRoutesSafety(
		@Req() req: AuthenticatedRequest,
		@Query() query: GetRouteSafetyOverviewQueryDto
	): Promise<RouteSafetyOverviewResponseDto> {
		return this.analyticsService.getRoutesSafetyOverview(req.user.userId, query);
	}
}
