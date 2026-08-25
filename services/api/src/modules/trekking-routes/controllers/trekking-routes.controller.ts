import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import type { CreateTrekkingRouteDto } from "../dto/create-trekking-route.dto";
import type { ListTrekkingRoutesQueryDto } from "../dto/list-trekking-routes-query.dto";
import { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
import type { TrekkingRoutesService } from "../services/trekking-routes.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("trekking-routes")
@ApiBearerAuth()
@Controller("trekking-routes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrekkingRoutesController {
	constructor(private readonly trekkingRoutesService: TrekkingRoutesService) {}

	@Get()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List trekking routes for an owned campsite" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and campsite ownership required" })
	@ApiResponse({ status: 404, description: "Campsite not found" })
	list(
		@Req() request: AuthenticatedRequest,
		@Query() query: ListTrekkingRoutesQueryDto
	): Promise<TrekkingRouteResponseDto[]> {
		return this.trekkingRoutesService.listByCampsite(request.user.userId, query.campsiteId);
	}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a draft trekking route for an owned campsite" })
	@ApiResponse({ status: 201, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and campsite ownership required" })
	@ApiResponse({ status: 404, description: "Campsite not found" })
	@ApiResponse({ status: 422, description: "Invalid route metadata or geometry" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateTrekkingRouteDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.create(request.user.userId, dto);
	}
}
