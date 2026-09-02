import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteIdParamDto } from "../../trekking-routes/dto/route-id-param.dto";
import { UserRole } from "../../users/entities/user.entity";
import { WeatherAdviceResponseDto } from "../dto/weather-advice-response.dto";
import { WeatherRiskAssessmentResponseDto } from "../dto/weather-risk-assessment-response.dto";
import { WeatherSnapshotResponseDto } from "../dto/weather-snapshot-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherAdviceService } from "../services/weather-advice.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskService } from "../services/weather-risk.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherService } from "../services/weather.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/**
 * CTMS-25-T01 & CTMS-26-T01. `@Roles(HOST, ADMIN)` narrows who can reach this at all;
 * ownership validation is deferred to services.
 */
@ApiTags("weather")
@ApiBearerAuth()
@Controller("trekking-routes/:routeId/weather")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class WeatherController {
	constructor(
		private readonly weatherService: WeatherService,
		private readonly weatherRiskService: WeatherRiskService,
		private readonly weatherAdviceService: WeatherAdviceService
	) {}

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

	@Post("risk-score")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Calculate weather risk score for a route" })
	@ApiResponse({ status: 201, type: WeatherRiskAssessmentResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({ status: 409, description: "Route is not active or missing weather snapshot" })
	calculateRisk(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherRiskAssessmentResponseDto> {
		return this.weatherRiskService.calculateForRoute(req.user, params.routeId);
	}

	@Get("risk-score/latest")
	@ApiOperation({ summary: "Get the most recently calculated weather risk assessment for a route" })
	@ApiResponse({ status: 200, type: WeatherRiskAssessmentResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	getLatestRisk(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherRiskAssessmentResponseDto | null> {
		return this.weatherRiskService.getLatestForRoute(req.user, params.routeId);
	}

	@Post("advice")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: "Generate LLM advice explaining a route's latest weather risk assessment",
	})
	@ApiResponse({ status: 201, type: WeatherAdviceResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({ status: 409, description: "Route is not active or missing a risk assessment" })
	@ApiResponse({ status: 503, description: "Weather advice service unavailable after retries" })
	generateAdvice(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherAdviceResponseDto> {
		return this.weatherAdviceService.generateForRoute(req.user, params.routeId);
	}

	@Get("advice/latest")
	@ApiOperation({ summary: "Get the most recently generated weather advice for a route" })
	@ApiResponse({ status: 200, type: WeatherAdviceResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Route not found" })
	getLatestAdvice(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<WeatherAdviceResponseDto | null> {
		return this.weatherAdviceService.getLatestForRoute(req.user, params.routeId);
	}
}
