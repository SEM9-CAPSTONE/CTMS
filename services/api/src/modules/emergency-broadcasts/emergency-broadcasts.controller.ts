import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import {
	// biome-ignore lint/style/useImportType: DTO validation metadata
	CreateEmergencyBroadcastDto,
	EmergencyBroadcastResponseDto,
} from "./dto/create-emergency-broadcast.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { EmergencyBroadcastsService } from "./emergency-broadcasts.service";
import type { EmergencyBroadcastView } from "./emergency-broadcasts.types";

/** Minimal response surface needed to choose 201 vs 200 (no express typings in this package). */
interface StatusResponse {
	status(code: number): unknown;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("emergency-broadcasts")
@ApiBearerAuth()
@Controller("trips/:tripId/emergency-broadcasts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 404, description: "Trip absent or outside the caller's scope" })
@ApiResponse({
	status: 422,
	description: "Invalid identifier or body (including any area targeting)",
})
export class EmergencyBroadcastsController {
	constructor(private readonly broadcasts: EmergencyBroadcastsService) {}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "CTMS-081: broadcast an emergency alert to a Trip the Host manages" })
	@ApiResponse({
		status: 201,
		type: EmergencyBroadcastResponseDto,
		description: "Created and delivered",
	})
	@ApiResponse({
		status: 200,
		type: EmergencyBroadcastResponseDto,
		description: "Same request retried",
	})
	@ApiResponse({ status: 403, description: "Host role required" })
	@ApiResponse({ status: 409, description: "Trip not published/ongoing, or broadcast ID reused" })
	async create(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", TRIP_ID_PIPE) tripId: string,
		@Body() dto: CreateEmergencyBroadcastDto,
		@Res({ passthrough: true }) response: StatusResponse
	): Promise<EmergencyBroadcastView> {
		const outcome = await this.broadcasts.create(request.user.userId, tripId, dto);
		response.status(outcome.created ? HttpStatus.CREATED : HttpStatus.OK);
		return outcome.broadcast;
	}

	@Get()
	@Roles(UserRole.HOST, UserRole.CAMPER, UserRole.PORTER)
	@ApiOperation({
		summary:
			"CTMS-081: Trip broadcasts — all for the managing Host, only those addressed to the caller otherwise",
	})
	@ApiResponse({ status: 200, type: [EmergencyBroadcastResponseDto] })
	list(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<EmergencyBroadcastView[]> {
		return this.broadcasts.list(request.user.userId, tripId);
	}
}
