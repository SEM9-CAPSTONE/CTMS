import { Controller, Get, Header, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe runtime metadata
import { TripIdParamDto } from "../dto/trip-id-param.dto";
import { TripLifecycleResponseDto } from "../dto/trip-lifecycle-response.dto";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { TripLifecycleService } from "../services/trip-lifecycle.service";

@ApiTags("trips")
@ApiBearerAuth()
@Controller("trips/:tripId/lifecycle")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
@ApiResponse({ status: 200, type: TripLifecycleResponseDto })
@ApiResponse({ status: 404, description: "Trip is not assigned to this Porter" })
@ApiResponse({ status: 409, description: "Transition or departure conditions are not satisfied" })
export class TripLifecycleController {
	constructor(private readonly lifecycle: TripLifecycleService) {}

	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "View assigned Trip lifecycle and allowed actions" })
	context(@Req() req: { user: AuthenticatedUser }, @Param() params: TripIdParamDto) {
		return this.lifecycle.context(req.user.userId, params.tripId);
	}

	@Post("start")
	@HttpCode(200)
	@ApiOperation({ summary: "Confirm actual departure as the assigned Porter" })
	start(@Req() req: { user: AuthenticatedUser }, @Param() params: TripIdParamDto) {
		return this.lifecycle.transition(req.user.userId, params.tripId, TripStatus.ONGOING);
	}

	@Post("end")
	@HttpCode(200)
	@ApiOperation({ summary: "Confirm actual Trip completion as the assigned Porter" })
	end(@Req() req: { user: AuthenticatedUser }, @Param() params: TripIdParamDto) {
		return this.lifecycle.transition(req.user.userId, params.tripId, TripStatus.COMPLETED);
	}
}
