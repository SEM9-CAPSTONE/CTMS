import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CheckpointIdParamDto } from "../dto/checkpoint-id-param.dto";
import { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateCheckpointDto } from "../dto/create-checkpoint.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateRouteDangerZoneDto } from "../dto/create-route-danger-zone.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateTrekkingRouteDto } from "../dto/create-trekking-route.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ReviewTrekkingRouteDto } from "../dto/review-trekking-route.dto";
import { RouteDangerZoneResponseDto } from "../dto/route-danger-zone-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteIdParamDto } from "../dto/route-id-param.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { RouteStatusReasonDto } from "../dto/route-status-reason.dto";
import { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
import { TrekkingRouteReviewResponseDto } from "../dto/trekking-route-review-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { UpdateCheckpointDto } from "../dto/update-checkpoint.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { UpdateTrekkingRouteDto } from "../dto/update-trekking-route.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CheckpointsService } from "../services/checkpoints.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteDangerZonesService } from "../services/route-danger-zones.service";
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
		private readonly checkpointsService: CheckpointsService,
		private readonly routeDangerZonesService: RouteDangerZonesService
	) {}

	@Get("pending-review")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "List pending trekking routes with Admin review details" })
	@ApiResponse({ status: 200, type: TrekkingRouteReviewResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	listPendingReview(): Promise<TrekkingRouteReviewResponseDto[]> {
		return this.trekkingRoutesService.listPendingReview();
	}

	@Patch(":routeId/submit-for-approval")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Submit an owned draft trekking route for Admin approval" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Route is not in draft status" })
	@ApiResponse({ status: 422, description: "Invalid stored Route or checkpoint preparation" })
	submitForApproval(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.submitForApproval(request.user.userId, params.routeId);
	}

	@Patch(":routeId/review")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Approve, decline, or mark a pending trekking route non-operable" })
	@ApiResponse({ status: 200, type: TrekkingRouteReviewResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Route is not pending approval" })
	@ApiResponse({ status: 422, description: "Invalid decision or stored Route integrity" })
	review(
		@Req() request: AuthenticatedRequest,
		@Param("routeId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		routeId: string,
		@Body() dto: ReviewTrekkingRouteDto
	): Promise<TrekkingRouteReviewResponseDto> {
		return this.trekkingRoutesService.review(request.user.userId, routeId, dto);
	}

	@Patch(":routeId/close")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Close an active trekking route" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host ownership or Admin role required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Invalid route status transition" })
	@ApiResponse({ status: 422, description: "Invalid reason" })
	close(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: RouteStatusReasonDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.close(request.user, params.routeId, dto);
	}

	@Patch(":routeId/reopen")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Reopen a closed trekking route for approval" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host ownership or Admin role required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Invalid transition or route integrity" })
	@ApiResponse({ status: 422, description: "Invalid reason" })
	reopen(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: RouteStatusReasonDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.reopen(request.user, params.routeId, dto);
	}

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

	@Patch(":routeId/checkpoints/:checkpointId")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Update a checkpoint on an owned draft trekking route" })
	@ApiResponse({ status: 200, type: CheckpointResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route or checkpoint not found" })
	@ApiResponse({ status: 409, description: "Route is not in draft status" })
	@ApiResponse({ status: 422, description: "Invalid checkpoint data or spatial relationship" })
	updateCheckpoint(
		@Req() request: AuthenticatedRequest,
		@Param() params: CheckpointIdParamDto,
		@Body() dto: UpdateCheckpointDto
	): Promise<CheckpointResponseDto> {
		return this.checkpointsService.update(
			request.user.userId,
			params.routeId,
			params.checkpointId,
			dto
		);
	}

	@Get(":routeId/hazard-areas")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List hazard areas for an owned trekking route" })
	@ApiResponse({ status: 200, type: RouteDangerZoneResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	listHazardAreas(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto
	): Promise<RouteDangerZoneResponseDto[]> {
		return this.routeDangerZonesService.list(request.user.userId, params.routeId);
	}

	@Post(":routeId/hazard-areas")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a hazard area on an owned draft trekking route" })
	@ApiResponse({ status: 201, type: RouteDangerZoneResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and route ownership required" })
	@ApiResponse({ status: 404, description: "Trekking route not found" })
	@ApiResponse({ status: 409, description: "Route is not in draft status" })
	@ApiResponse({ status: 422, description: "Invalid hazard-area data or geometry" })
	createHazardArea(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: CreateRouteDangerZoneDto
	): Promise<RouteDangerZoneResponseDto> {
		return this.routeDangerZonesService.create(request.user.userId, params.routeId, dto);
	}

	@Patch(":routeId")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Update an owned draft trekking route" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 403, description: "Host ownership required" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({ status: 409, description: "Only drafts can be edited" })
	@ApiResponse({ status: 422, description: "Invalid route or incompatible checkpoints" })
	updateDraft(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: UpdateTrekkingRouteDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.updateDraft(request.user.userId, params.routeId, dto);
	}

	@Get()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List trekking routes owned by the current Host" })
	@ApiResponse({ status: 200, type: TrekkingRouteResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	list(@Req() request: AuthenticatedRequest): Promise<TrekkingRouteResponseDto[]> {
		return this.trekkingRoutesService.listByHost(request.user.userId);
	}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a draft trekking route for the current Host" })
	@ApiResponse({ status: 201, type: TrekkingRouteResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	@ApiResponse({ status: 422, description: "Invalid route metadata or geometry" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateTrekkingRouteDto
	): Promise<TrekkingRouteResponseDto> {
		return this.trekkingRoutesService.create(request.user.userId, dto);
	}
}
