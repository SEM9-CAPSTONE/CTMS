import {
	Controller,
	type ExecutionContext,
	Get,
	Header,
	HttpStatus,
	Param,
	ParseEnumPipe,
	ParseUUIDPipe,
	Query,
	UseGuards,
	createParamDecorator,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO validation metadata
import { HostTripMapQueryDto } from "./host-trip-map.dto";
import { HOST_TRIP_MAP_SCHEMA, MAP_PARTICIPANT_DETAIL_SCHEMA } from "./host-trip-map.schema";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { HostTripMapService } from "./host-trip-map.service";

const CurrentMapHost = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser =>
		context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user
);
const uuid = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("host-trip-map")
@ApiBearerAuth()
@Controller("host/monitoring/active-trips")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Active Host required" })
@ApiResponse({ status: 422, description: "Invalid query or identifier" })
export class HostTripMapController {
	constructor(private readonly map: HostTripMapService) {}

	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiOkResponse({ schema: HOST_TRIP_MAP_SCHEMA })
	@ApiOperation({ summary: "CTMS-369: authorized active Trip map with server-confirmed locations" })
	getMap(@CurrentMapHost() actor: AuthenticatedUser, @Query() query: HostTripMapQueryDto) {
		return this.map.getMap(actor, query);
	}

	@Get(":tripId/participants/:role/:participantId")
	@Header("Cache-Control", "private, no-store")
	@ApiOkResponse({ schema: MAP_PARTICIPANT_DETAIL_SCHEMA })
	@ApiOperation({
		summary: "Read an authorized active Trip participant's location and safety details",
	})
	@ApiResponse({
		status: 404,
		description: "Participant absent, inactive Trip or outside Host scope",
	})
	getParticipant(
		@CurrentMapHost() actor: AuthenticatedUser,
		@Param("tripId", uuid) tripId: string,
		@Param(
			"role",
			new ParseEnumPipe(GpsParticipantRole, {
				errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
			})
		)
		role: GpsParticipantRole,
		@Param("participantId", uuid) participantId: string
	) {
		return this.map.getParticipant(actor, tripId, role, participantId);
	}
}
