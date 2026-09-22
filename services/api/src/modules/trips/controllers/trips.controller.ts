import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { ConfigureTripWaypointsDto, CreateTripDto } from "../dto/create-trip.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { TripIdParamDto } from "../dto/trip-id-param.dto";
import { PaginatedTripsResponseDto, TripResponseDto } from "../dto/trip-response.dto";
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
	constructor(private readonly tripsService: TripsService) {}

	@Get()
	@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.ADMIN, UserRole.PORTER)
	@ApiOperation({ summary: "Search and list published trekking trips" })
	@ApiResponse({ status: 200, type: PaginatedTripsResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 422, description: "Invalid search query parameters" })
	search(@Query() query: SearchTripsQueryDto): Promise<PaginatedTripsResponseDto> {
		return this.tripsService.search(query);
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
}
