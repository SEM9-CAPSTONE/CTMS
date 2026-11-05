import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO runtime validation
import {
	AnalysisInsightsQueryDto,
	AnalysisPageDto,
	EmptyAnalysisRequestDto,
} from "./review-analysis.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisService } from "./review-analysis.service";
const ID = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
interface ActorRequest {
	user: AuthenticatedUser;
}
@ApiTags("review-analysis")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class ReviewAnalysisController {
	constructor(private readonly service: ReviewAnalysisService) {}
	@Get("review-analysis/trips")
	@ApiOperation({ summary: "List analysis Trips visible to the current Host or Admin" })
	trips(@Req() req: ActorRequest, @Query() page: AnalysisPageDto) {
		return this.service.trips(req.user.userId, page);
	}
	@Get("trips/:tripId/review-analyses/:reviewId/source/:revision")
	@ApiOperation({
		summary: "Read an authorized, eligible source revision without reviewer identity",
	})
	source(
		@Req() req: ActorRequest,
		@Param("tripId", ID) tripId: string,
		@Param("reviewId", ID) reviewId: string,
		@Param("revision") revision: string
	) {
		return this.service.sourceReview(req.user.userId, tripId, reviewId, revision);
	}
	@Post("trips/:tripId/review-analysis-batches")
	@HttpCode(202)
	@ApiOperation({ summary: "Queue up to 20 eligible review revisions, or return the active batch" })
	@ApiResponse({ status: 202 })
	create(
		@Req() req: ActorRequest,
		@Param("tripId", ID) tripId: string,
		@Body() _body: EmptyAnalysisRequestDto
	) {
		return this.service.create(req.user.userId, tripId);
	}
	@Get("trips/:tripId/review-analysis-batches/:batchId")
	@ApiOperation({ summary: "Read batch progress, attempts and currentness" })
	batch(
		@Req() req: ActorRequest,
		@Param("tripId", ID) tripId: string,
		@Param("batchId", ID) batchId: string
	) {
		return this.service.batch(req.user.userId, tripId, batchId);
	}
	@Get("trips/:tripId/review-analyses")
	@ApiOperation({ summary: "Read current derived insights and consistent Trip coverage" })
	insights(
		@Req() req: ActorRequest,
		@Param("tripId", ID) tripId: string,
		@Query() page: AnalysisInsightsQueryDto
	) {
		return this.service.insights(req.user.userId, tripId, page);
	}
	@Post("trip-review-analyses/:reviewId/redact")
	@HttpCode(200)
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Erase derived content and suppress future analysis for privacy" })
	redact(
		@Req() req: ActorRequest,
		@Param("reviewId", ID) reviewId: string,
		@Body() _body: EmptyAnalysisRequestDto
	) {
		return this.service.redact(req.user.userId, reviewId);
	}
}
