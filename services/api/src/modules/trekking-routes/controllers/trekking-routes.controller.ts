import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateCheckpointDto } from "../dto/create-checkpoint.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateTrekkingRouteDto } from "../dto/create-trekking-route.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ListTrekkingRoutesQueryDto } from "../dto/list-trekking-routes-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteIdParamDto } from "../dto/route-id-param.dto";
import { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CheckpointsService } from "../services/checkpoints.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TrekkingRoutesService } from "../services/trekking-routes.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("trekking-routes")
@ApiBearerAuth()
@Controller("trekking-routes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrekkingRoutesController {
	constructor(
		private readonly trekkingRoutesService: TrekkingRoutesService,
		private readonly checkpointsService: CheckpointsService
	) {}

	@Get(":routeId/checkpoints")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List checkpoints for an owned trekking route" })
	@ApiResponse({ status: 200, type: CheckpointResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	listCheckpoints(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto
	): Promise<CheckpointResponseDto[]> {
		return this.checkpointsService.list(request.user.userId, params.routeId);
	}

	@Post(":routeId/checkpoints")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a checkpoint on an owned draft trekking route" })
	@ApiResponse({ status: 201, type: CheckpointResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Route is not in draft status" })
	@ApiResponse({ status: 422, description: "Invalid checkpoint data or spatial relationship" })
	createCheckpoint(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: CreateCheckpointDto
	): Promise<CheckpointResponseDto> {
		return this.checkpointsService.create(request.user.userId, params.routeId, dto);
	}

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
