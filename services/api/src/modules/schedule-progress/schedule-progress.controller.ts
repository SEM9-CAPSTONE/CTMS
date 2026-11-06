import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { ScheduleProgressResponseDto } from "./dto/schedule-progress-response.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { ScheduleProgressService } from "./schedule-progress.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("schedule-progress")
@ApiBearerAuth()
@Controller("trips/:tripId")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER, UserRole.HOST)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Not the Trip Host, an assigned Porter or a Trip Camper" })
@ApiResponse({ status: 404, description: "Trip not found" })
export class ScheduleProgressController {
	constructor(private readonly scheduleProgress: ScheduleProgressService) {}

	@Get("schedule-progress")
	@ApiOperation({
		summary:
			"CTMS-063: lagging-behind-the-Porter status per Camper (own status for a Camper; every Camper for the Host or an assigned Porter)",
	})
	@ApiResponse({ status: 200, type: ScheduleProgressResponseDto })
	async getScheduleProgress(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<ScheduleProgressResponseDto> {
		const result = await this.scheduleProgress.getProgress(request.user.userId, tripId);
		return {
			...result,
			evaluatedAt: result.evaluatedAt.toISOString(),
			members: result.members.map((member) => ({
				userId: member.userId,
				fullName: member.fullName,
				status: member.status,
				reference: member.reference
					? {
							checkpointId: member.reference.checkpointId,
							checkpointName: member.reference.checkpointName,
							porterArrivedAt: member.reference.porterArrivedAt.toISOString(),
						}
					: null,
				lagMinutes: member.lagMinutes,
				safeCheckpoint: member.safeCheckpoint,
				guidance: member.guidance,
				lastValidSampleAt: member.lastValidSampleAt?.toISOString() ?? null,
				levelsReached: member.levelsReached,
			})),
		};
	}
}
