import {
	Controller,
	Get,
	Header,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { TripMemberLocationsDto } from "./dto/member-locations-response.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { MemberLocationsService } from "./member-locations.service";
import type { TripMemberLocations } from "./member-locations.types";

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("member-locations")
@ApiBearerAuth()
@Controller("trips/:tripId")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.PORTER)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Host or Porter role required" })
@ApiResponse({ status: 404, description: "Trip absent or outside the caller's Host/Porter scope" })
@ApiResponse({ status: 409, description: "Trip is not ongoing" })
@ApiResponse({ status: 422, description: "Invalid Trip identifier" })
export class MemberLocationsController {
	constructor(private readonly memberLocations: MemberLocationsService) {}

	@Get("member-locations")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary:
			"CTMS-066: each eligible member's last server-confirmed location, last_seen_at, freshness and synchronized safety flags",
	})
	@ApiOkResponse({ type: TripMemberLocationsDto })
	getMemberLocations(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<TripMemberLocations> {
		return this.memberLocations.getMemberLocations(request.user.userId, tripId);
	}
}
