import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { PaginatedAvailablePortersResponseDto } from "../dto/available-porter-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { AvailablePortersQueryDto } from "../dto/available-porters-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ConfigureTripWaypointsDto, CreateTripDto } from "../dto/create-trip.dto";
import { PorterAssignedTripResponseDto } from "../dto/porter-assigned-trip-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CancelTripDto, RescheduleTripDto } from "../dto/reschedule-trip.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ReviewTripDto } from "../dto/review-trip.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { TripIdParamDto } from "../dto/trip-id-param.dto";
import { PaginatedTripsResponseDto, TripResponseDto } from "../dto/trip-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AvailablePortersService } from "../services/available-porters.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripsService } from "../services/trips.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("trips")
@ApiBearerAuth()
@Controller("trips")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
	constructor(
		private readonly tripsService: TripsService,
		private readonly availablePortersService: AvailablePortersService
	) {}

	@Get()
	@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.ADMIN, UserRole.PORTER)
	@ApiOperation({ summary: "Search and list published trekking trips" })
	@ApiResponse({ status: 200, type: PaginatedTripsResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 422, description: "Invalid search query parameters" })
	search(@Query() query: SearchTripsQueryDto): Promise<PaginatedTripsResponseDto> {
		return this.tripsService.search(query);
	}

	@Get("pending-review")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "List Trips pending Admin approval" })
	@ApiResponse({ status: 200, type: TripResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	listPendingReview(): Promise<TripResponseDto[]> {
		return this.tripsService.listPendingReview();
	}

	@Get("mine")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List trips owned by the current Host" })
	@ApiResponse({ status: 200, type: TripResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	getMyTrips(@Req() request: AuthenticatedRequest): Promise<TripResponseDto[]> {
		return this.tripsService.getMyTrips(request.user.userId);
	}

	@Get("assigned")
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "List Trips currently assigned to the authenticated Porter" })
	@ApiResponse({ status: 200, type: PorterAssignedTripResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Porter role required" })
	getAssignedTrips(@Req() request: AuthenticatedRequest): Promise<PorterAssignedTripResponseDto[]> {
		return this.tripsService.getAssignedTrips(request.user.userId);
	}

	@Get(":tripId/available-porters")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List eligible, currently available Porters for an owned Trip" })
	@ApiResponse({ status: 200, type: PaginatedAvailablePortersResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 422, description: "Invalid search query parameters" })
	getAvailablePorters(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Query() query: AvailablePortersQueryDto
	): Promise<PaginatedAvailablePortersResponseDto> {
		return this.availablePortersService.search(request.user.userId, params.tripId, query);
	}

	@Get(":tripId")
	@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.ADMIN, UserRole.PORTER)
	@ApiOperation({ summary: "View trip details" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	getTripDetails(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto
	): Promise<TripResponseDto> {
		return this.tripsService.getTripDetails(request.user, params.tripId);
	}

	@Patch(":tripId/waypoints")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Configure waypoints and submit an owned draft Trip for approval" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip is not in a configurable status" })
	@ApiResponse({ status: 422, description: "Invalid waypoint data" })
	configureWaypoints(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: ConfigureTripWaypointsDto
	): Promise<TripResponseDto> {
		return this.tripsService.configureWaypoints(request.user.userId, params.tripId, dto);
	}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a draft Trip from an approved active Route" })
	@ApiResponse({ status: 201, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Route ownership required" })
	@ApiResponse({ status: 404, description: "Referenced Route not found" })
	@ApiResponse({ status: 409, description: "Route is not active or dependency is invalid" })
	@ApiResponse({ status: 422, description: "Invalid Trip data" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateTripDto
	): Promise<TripResponseDto> {
		return this.tripsService.create(request.user.userId, dto);
	}

	@Patch(":tripId")
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary: "Edit an owned pre-published Trip without changing its identity",
		description:
			"Allowed while the Trip is draft or pending_approval. A pending_approval edit remains pending_approval and updates updated_at so Admin review must use the latest version.",
	})
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip or referenced Route not found" })
	@ApiResponse({
		status: 409,
		description: "Trip is not draft/pending_approval or Route is not active",
	})
	@ApiResponse({ status: 422, description: "Invalid Trip data" })
	updateDraft(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: CreateTripDto
	): Promise<TripResponseDto> {
		return this.tripsService.updateDraft(request.user.userId, params.tripId, dto);
	}

	@Patch(":tripId/reschedule")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Reschedule an owned published Trip" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip state does not allow reschedule" })
	@ApiResponse({ status: 422, description: "Invalid reschedule payload" })
	reschedule(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: RescheduleTripDto
	): Promise<TripResponseDto> {
		return this.tripsService.reschedule(request.user.userId, params.tripId, dto);
	}

	@Patch(":tripId/cancel")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Cancel an owned Trip before completion" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip state does not allow cancellation" })
	@ApiResponse({ status: 422, description: "Invalid cancellation payload" })
	cancel(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: CancelTripDto
	): Promise<TripResponseDto> {
		return this.tripsService.cancel(request.user.userId, params.tripId, dto);
	}

	@Patch(":tripId/review")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Approve (publish) or decline a Trip pending approval" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip is not in pending_approval status" })
	@ApiResponse({ status: 422, description: "Invalid review decision or Route no longer active" })
	review(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: ReviewTripDto
	): Promise<TripResponseDto> {
		return this.tripsService.review(request.user.userId, params.tripId, dto);
	}
}
