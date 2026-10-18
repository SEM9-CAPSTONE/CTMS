import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
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
import { CreatePorterRequestDto } from "../dto/create-porter-request.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import {
	ConfigureTripWaypointsDto,
	CreateTripDto,
	CreateTripWaypointDto,
} from "../dto/create-trip.dto";
import { HostPorterAssignmentTripDto } from "../dto/host-porter-assignment-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ListTripReviewsQueryDto } from "../dto/list-trip-reviews-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { PendingPorterRequestQueryDto } from "../dto/pending-porter-request-query.dto";
import { PorterAssignedTripResponseDto } from "../dto/porter-assigned-trip-response.dto";
import { PorterRequestResponseDto } from "../dto/porter-request-response.dto";
import { PorterTripOperationsResponseDto } from "../dto/porter-trip-operations-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CancelTripDto, RescheduleTripDto } from "../dto/reschedule-trip.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ReviewTripDto } from "../dto/review-trip.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { TripIdParamDto } from "../dto/trip-id-param.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { TripPorterRequestParamDto } from "../dto/trip-porter-request-param.dto";
import {
	PaginatedTripReviewsResponseDto,
	PaginatedTripsResponseDto,
	TripResponseDto,
} from "../dto/trip-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { TripWaypointParamDto } from "../dto/trip-waypoint-param.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AvailablePortersService } from "../services/available-porters.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PorterRequestsService } from "../services/porter-requests.service";
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
		private readonly availablePortersService: AvailablePortersService,
		private readonly porterRequestsService: PorterRequestsService
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

	@Get("admin-reviews")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "List Trip review outcomes for Admin" })
	@ApiResponse({ status: 200, type: PaginatedTripReviewsResponseDto })
	@ApiResponse({ status: 400, description: "Invalid review filter or pagination query" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	listAdminReviews(
		@Query() query: ListTripReviewsQueryDto
	): Promise<PaginatedTripReviewsResponseDto> {
		return this.tripsService.listAdminReviews(query);
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

	@Get("porter-candidates")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List upcoming owned Trips available for Porter search" })
	@ApiResponse({ status: 200, type: TripResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	getPorterCandidateTrips(@Req() request: AuthenticatedRequest): Promise<TripResponseDto[]> {
		return this.tripsService.getUpcomingTripsWithoutPorter(request.user.userId);
	}

	@Get("porter-assignments")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List Porter assignment history for Trips owned by the current Host" })
	@ApiResponse({ status: 200, type: HostPorterAssignmentTripDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	getPorterAssignmentHistory(
		@Req() request: AuthenticatedRequest
	): Promise<HostPorterAssignmentTripDto[]> {
		return this.tripsService.getPorterAssignmentHistory(request.user.userId);
	}

	@Get("assigned")
	@Header("Cache-Control", "private, no-store")
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "List Trips currently assigned to the authenticated Porter" })
	@ApiResponse({ status: 200, type: PorterAssignedTripResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Porter role required" })
	getAssignedTrips(@Req() request: AuthenticatedRequest): Promise<PorterAssignedTripResponseDto[]> {
		return this.tripsService.getAssignedTrips(request.user.userId);
	}

	@Get("assigned/:tripId")
	@Header("Cache-Control", "private, no-store")
	@Roles(UserRole.PORTER)
	@ApiOperation({
		summary: "View operational data for a Trip assigned to the authenticated Porter",
	})
	@ApiResponse({ status: 200, type: PorterTripOperationsResponseDto })
	@ApiResponse({
		status: 404,
		description: "Trip does not have a valid Assignment for this Porter",
	})
	getAssignedTripOperations(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto
	): Promise<PorterTripOperationsResponseDto> {
		return this.tripsService.getAssignedTripOperations(request.user.userId, params.tripId);
	}

	@Get("porter-requests/mine")
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "List Porter Requests received by the authenticated Porter" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Porter role required" })
	listMyPorterRequests(@Req() request: AuthenticatedRequest): Promise<PorterRequestResponseDto[]> {
		return this.porterRequestsService.listForPorter(request.user.userId);
	}

	@Get("porter-requests/host")
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary: "List pending, accepted, and declined Porter Requests sent by the Host",
	})
	@ApiResponse({ status: 200, type: PorterRequestResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	listHostPorterRequests(
		@Req() request: AuthenticatedRequest
	): Promise<PorterRequestResponseDto[]> {
		return this.porterRequestsService.listForHost(request.user.userId);
	}

	@Patch("porter-requests/:requestId/accept")
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "Accept a Porter Request and create the Trip assignment atomically" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Only the requested Porter may accept" })
	@ApiResponse({ status: 404, description: "Porter Request not found" })
	@ApiResponse({ status: 409, description: "Request, Trip, Porter, or Assignment is not eligible" })
	acceptPorterRequest(
		@Req() request: AuthenticatedRequest,
		@Param("requestId") requestId: string
	): Promise<PorterRequestResponseDto> {
		return this.porterRequestsService.accept(request.user.userId, requestId);
	}

	@Patch("porter-requests/:requestId/decline")
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "Decline a Porter Request" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Only the requested Porter may decline" })
	@ApiResponse({ status: 404, description: "Porter Request not found" })
	@ApiResponse({ status: 409, description: "Request is already terminal" })
	declinePorterRequest(
		@Req() request: AuthenticatedRequest,
		@Param("requestId") requestId: string
	): Promise<PorterRequestResponseDto> {
		return this.porterRequestsService.decline(request.user.userId, requestId);
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

	@Post(":tripId/porter-requests")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Request an eligible Porter for an owned Trip" })
	@ApiResponse({ status: 201, type: PorterRequestResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip or Porter is not eligible for a request" })
	@ApiResponse({ status: 422, description: "Invalid request payload" })
	createPorterRequest(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: CreatePorterRequestDto
	): Promise<PorterRequestResponseDto> {
		return this.porterRequestsService.create(request.user.userId, params.tripId, dto);
	}

	@Get(":tripId/porter-requests/pending")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Get an active pending Porter Request for an owned Trip and Porter" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 422, description: "Invalid query parameters" })
	getPendingPorterRequest(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Query() query: PendingPorterRequestQueryDto
	): Promise<PorterRequestResponseDto | null> {
		return this.porterRequestsService.findPending(
			request.user.userId,
			params.tripId,
			query.porterId
		);
	}

	@Get(":tripId/porter-requests")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List Porter Requests for an owned Trip" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	listPorterRequestsForTrip(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto
	): Promise<PorterRequestResponseDto[]> {
		return this.porterRequestsService.listForHostTrip(request.user.userId, params.tripId);
	}

	@Patch(":tripId/porter-requests/:requestId/cancel")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Cancel a pending Porter Request for an owned Trip" })
	@ApiResponse({ status: 200, type: PorterRequestResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Porter Request not found" })
	@ApiResponse({ status: 409, description: "Request is already terminal" })
	cancelPorterRequest(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripPorterRequestParamDto
	): Promise<PorterRequestResponseDto> {
		return this.porterRequestsService.cancel(request.user.userId, params.tripId, params.requestId);
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

	@Post(":tripId/waypoints")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Add a waypoint to an owned draft Trip" })
	@ApiResponse({ status: 201, type: TripResponseDto })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip is not a draft" })
	@ApiResponse({ status: 422, description: "Invalid waypoint data" })
	createWaypoint(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto,
		@Body() dto: CreateTripWaypointDto
	): Promise<TripResponseDto> {
		return this.tripsService.createWaypoint(request.user.userId, params.tripId, dto);
	}

	@Put(":tripId/waypoints/:waypointId")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Update a waypoint of an owned draft Trip" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip or waypoint not found" })
	@ApiResponse({ status: 409, description: "Trip is not a draft or endpoint type change" })
	@ApiResponse({ status: 422, description: "Invalid waypoint data" })
	updateWaypoint(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripWaypointParamDto,
		@Body() dto: CreateTripWaypointDto
	): Promise<TripResponseDto> {
		return this.tripsService.updateWaypoint(
			request.user.userId,
			params.tripId,
			params.waypointId,
			dto
		);
	}

	@Delete(":tripId/waypoints/:waypointId")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Delete a stop waypoint of an owned draft Trip" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip or waypoint not found" })
	@ApiResponse({ status: 409, description: "Trip is not a draft or waypoint is start/finish" })
	deleteWaypoint(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripWaypointParamDto
	): Promise<TripResponseDto> {
		return this.tripsService.deleteWaypoint(request.user.userId, params.tripId, params.waypointId);
	}

	@Post(":tripId/submit")
	@HttpCode(200)
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Submit an owned draft Trip for approval with its stored waypoints" })
	@ApiResponse({ status: 200, type: TripResponseDto })
	@ApiResponse({ status: 403, description: "Host role and Trip ownership required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip is not a draft" })
	@ApiResponse({ status: 422, description: "Stored waypoints are not ready for approval" })
	submitForApproval(
		@Req() request: AuthenticatedRequest,
		@Param() params: TripIdParamDto
	): Promise<TripResponseDto> {
		return this.tripsService.submitForApproval(request.user.userId, params.tripId);
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
