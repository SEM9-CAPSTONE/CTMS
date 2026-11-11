import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated parameter DTO needs runtime metadata
import { PorterRouteIdParamDto } from "../dto/porter-qualification-param.dto";
import { RoutePorterQualificationResponseDto } from "../dto/porter-route-qualification-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterRouteQualificationsService } from "../services/porter-route-qualifications.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("trekking-route-porter-qualifications")
@ApiBearerAuth()
@Controller("trekking-routes/:routeId/porter-qualifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class RoutePorterQualificationsController {
	constructor(private readonly qualificationsService: PorterRouteQualificationsService) {}

	@Get()
	@ApiOperation({ summary: "List minimal Porter qualification claims for a Route" })
	@ApiResponse({ status: 200, type: RoutePorterQualificationResponseDto, isArray: true })
	listForRoute(
		@Req() request: AuthenticatedRequest,
		@Param() params: PorterRouteIdParamDto
	): Promise<RoutePorterQualificationResponseDto[]> {
		return this.qualificationsService.listForRoute(request.user, params.routeId);
	}
}
