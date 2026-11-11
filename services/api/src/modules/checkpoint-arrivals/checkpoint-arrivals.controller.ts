import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: NestJS validation metadata
import {
	CheckpointArrivalSyncResponseDto,
	SyncAutomaticCheckpointArrivalsDto,
} from "./checkpoint-arrivals.dto";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { CheckpointArrivalsService } from "./checkpoint-arrivals.service";
import type { CheckpointArrivalResult } from "./checkpoint-arrivals.types";

@ApiTags("automatic-checkpoint-arrivals")
@ApiBearerAuth()
@Controller("trips/:tripId/automatic-checkpoint-arrivals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
export class CheckpointArrivalsController {
	constructor(private readonly arrivals: CheckpointArrivalsService) {}

	@Get("context")
	@ApiOperation({
		summary: "Retrieve pinned checkpoint context for trip",
	})
	@ApiResponse({
		status: 200,
		description: "Active checkpoint context for offline detection",
	})
	@ApiResponse({ status: 404, description: "Context not found" })
	getContext(
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string
	) {
		return this.arrivals.getContext(tripId);
	}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Synchronize on-device CHECKPOINT_REACHED events with per-record acknowledgement",
	})
	@ApiResponse({
		status: 200,
		type: CheckpointArrivalSyncResponseDto,
		description: "Per record: id, accepted/duplicate/rejected, reason, visitId, receivedAt",
	})
	@ApiResponse({ status: 403, description: "Not a Trip participant" })
	@ApiResponse({ status: 409, description: "Active package checkpoint context not available" })
	@ApiResponse({ status: 422, description: "Malformed synchronization batch" })
	synchronize(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string,
		@Body() dto: SyncAutomaticCheckpointArrivalsDto
	): Promise<{ results: CheckpointArrivalResult[] }> {
		return this.arrivals.synchronize(request.user.userId, tripId, dto);
	}
}
