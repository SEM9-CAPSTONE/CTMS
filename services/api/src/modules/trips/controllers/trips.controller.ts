import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateTripDto } from "../dto/create-trip.dto";
import { TripResponseDto } from "../dto/trip-response.dto";
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
