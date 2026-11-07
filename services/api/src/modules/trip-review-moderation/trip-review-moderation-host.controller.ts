import { createReadStream } from "node:fs";
import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseIntPipe,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	StreamableFile,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import type { CreateModerationDecisionDto } from "./dtos/create-moderation-decision.dto";
import type { GetHostModerationQueueQueryDto } from "./dtos/get-host-moderation-queue-query.dto";
import { ModerationDecisionResponseDto } from "./dtos/moderation-decision-response.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { TripReviewModerationHostService } from "./trip-review-moderation-host.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("host-trip-review-moderation")
@ApiBearerAuth()
@Controller("host/trip-reviews")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class TripReviewModerationHostController {
	constructor(private readonly service: TripReviewModerationHostService) {}

	@Get("moderation-queue")
	@ApiOperation({ summary: "Get moderation queue items for the authenticated host" })
	@ApiResponse({ status: 200, description: "Returns queue items with active violation flags" })
	async getQueue(@Req() req: AuthenticatedRequest, @Query() query: GetHostModerationQueueQueryDto) {
		return this.service.getQueue(req.user.userId, query);
	}

	@Post(":reviewId/decisions")
	@ApiOperation({ summary: "Record host moderation decision (keep, hide, or restore)" })
	@ApiResponse({
		status: 201,
		type: ModerationDecisionResponseDto,
		description: "Decision recorded and review status updated",
	})
	@ApiResponse({ status: 400, description: "Invalid reason or missing parameter" })
	@ApiResponse({ status: 403, description: "Host does not own this trip" })
	@ApiResponse({ status: 404, description: "Review not found" })
	@ApiResponse({ status: 409, description: "Stale revision; review was modified by camper" })
	async recordDecision(
		@Req() req: AuthenticatedRequest,
		@Param("reviewId", ID_PIPE) reviewId: string,
		@Body() dto: CreateModerationDecisionDto
	): Promise<ModerationDecisionResponseDto> {
		return this.service.recordDecision(req.user.userId, reviewId, dto);
	}

	@Get(":reviewId/quarantined-images/:imageIndex")
	@ApiOperation({ summary: "Stream quarantined image file for host evidence inspection" })
	@ApiResponse({ status: 200, description: "Returns the quarantined image file stream" })
	@ApiResponse({ status: 403, description: "Host does not own this trip" })
	@ApiResponse({ status: 404, description: "Quarantined image not found" })
	@ApiResponse({ status: 409, description: "Image file operation in progress" })
	async getQuarantinedImage(
		@Req() req: AuthenticatedRequest,
		@Param("reviewId", ID_PIPE) reviewId: string,
		@Param("imageIndex", ParseIntPipe) imageIndex: number
	): Promise<StreamableFile> {
		const { filePath } = await this.service.getQuarantinedImageFile(
			req.user.userId,
			reviewId,
			imageIndex
		);
		const stream = createReadStream(filePath);
		return new StreamableFile(stream);
	}
}
