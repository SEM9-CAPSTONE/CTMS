import { Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteIdParamDto } from "../../trekking-routes/dto/route-id-param.dto";
import { UserRole } from "../../users/entities/user.entity";
import { RegistrationEligibilityResponseDto } from "../dto/registration-eligibility-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteRegistrationRiskService } from "../services/route-registration-risk.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("weather")
@ApiBearerAuth()
@Controller("trekking-routes/:routeId/check-registration-eligibility")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.ADMIN, UserRole.PORTER)
export class RouteRegistrationRiskController {
	constructor(private readonly routeRegistrationRiskService: RouteRegistrationRiskService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Check registration eligibility for a route based on weather risk (CTMS-28)",
		description:
			"Evaluates weather risk level for a route. If risk level is RED, returns HTTP 409 Conflict with detailed failing criteria reasons and assessment timestamp.",
	})
	@ApiResponse({
		status: 200,
		type: RegistrationEligibilityResponseDto,
		description: "Registration is allowed (Risk is Green or Yellow)",
	})
	@ApiResponse({
		status: 401,
		description: "Authentication required or invalid session",
	})
	@ApiResponse({
		status: 403,
		description: "User account suspended or unverified (BR-202)",
	})
	@ApiResponse({
		status: 404,
		description: "Trekking route not found",
	})
	@ApiResponse({
		status: 409,
		description: "Registration blocked because route risk level is RED (BR-072)",
	})
	checkEligibility(
		@Param() params: RouteIdParamDto,
		@Req() req: AuthenticatedRequest
	): Promise<RegistrationEligibilityResponseDto> {
		return this.routeRegistrationRiskService.assertRegistrationAllowedForRoute(
			req.user,
			params.routeId
		);
	}
}
