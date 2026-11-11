import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest DI runtime metadata
import { DeviceSyncService } from "./device-sync.service";
import { DeviceSyncStatusResponseDto } from "./dto/device-sync-status-response.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("device-sync")
@ApiBearerAuth()
@Controller("trips/:tripId/device-sync")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER, UserRole.HOST)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Caller not a Trip participant or Host" })
@ApiResponse({ status: 404, description: "Trip not found" })
export class DeviceSyncController {
	constructor(private readonly deviceSync: DeviceSyncService) {}

	@Get("status")
	@ApiOperation({
		summary: "Authoritative device synchronization status for the caller on a Trip (CTMS-067)",
	})
	@ApiResponse({ status: 200, type: DeviceSyncStatusResponseDto })
	getStatus(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<DeviceSyncStatusResponseDto> {
		return this.deviceSync.getSyncStatus(request.user.userId, request.user.roles, tripId);
	}
}
