import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteIdParamDto } from "../../trekking-routes/dto/route-id-param.dto";
import { UserRole } from "../../users/entities/user.entity";
import { WeatherSnapshotResponseDto } from "../dto/weather-snapshot-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherService } from "../services/weather.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/**
 * CTMS-25-T01. `@Roles(HOST, ADMIN)` narrows who can reach this at all
 * (matches TrekkingRoutesController's close/reopen endpoints); actual route
 * *ownership* for a Host still can't be expressed by role alone, so
 * WeatherService checks it against the real row, same split as those.
 */
@ApiTags("weather")
@ApiBearerAuth()
@Controller("trekking-routes/:routeId/weather")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class WeatherController {
	constructor(private readonly weatherService: WeatherService) {}

	@Post("refresh")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Fetch fresh weather data for a route's area and persist a snapshot" })
	@ApiResponse({ status: 201, type: WeatherSnapshotResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({ status: 409, description: "Route is not active" })
	@ApiResponse({ status: 503, description: "Weather provider unavailable after retries" })
	refresh(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherSnapshotResponseDto> {
		return this.weatherService.refreshForRoute(req.user, params.routeId);
	}

	@Get("latest")
	@ApiOperation({ summary: "Get the most recently stored weather snapshot for a route" })
	@ApiResponse({ status: 200, type: WeatherSnapshotResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	getLatest(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherSnapshotResponseDto | null> {
		return this.weatherService.getLatestForRoute(req.user, params.routeId);
	}
}
