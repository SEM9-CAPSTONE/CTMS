import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
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
import {
	PorterReviewContextResponseDto,
	PorterReviewResponseDto,
} from "./dto/porter-review-response.dto";
// biome-ignore lint/style/useImportType: runtime DTO validation
import { CreatePorterReviewDto, UpdatePorterReviewDto } from "./dto/porter-review.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { PorterReviewsService } from "./porter-reviews.service";

const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("porter-reviews")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Camper role required" })
@ApiResponse({ status: 404, description: "No accessible participation, assignment or review" })
@ApiResponse({
	status: 409,
	description: "Ineligible participation, closed window, duplicate or stale revision",
})
@ApiResponse({ status: 422, description: "Invalid input" })
export class PorterReviewsController {
	constructor(private readonly reviews: PorterReviewsService) {}

	@Get("bookings/:bookingId/porter-reviews/context")
	@ApiResponse({ status: 200, type: PorterReviewContextResponseDto })
	@ApiOperation({ summary: "Read own Porter review eligibility, original deadlines and reviews" })
	context(@Req() request: AuthenticatedRequest, @Param("bookingId", ID_PIPE) bookingId: string) {
		return this.reviews.context(request.user.userId, bookingId);
	}

	@Post("bookings/:bookingId/porter-reviews")
	@ApiResponse({ status: 201, type: PorterReviewResponseDto })
	@ApiOperation({
		summary: "Review a Porter resolved from the completed participation's assignment",
	})
	create(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", ID_PIPE) bookingId: string,
		@Body() dto: CreatePorterReviewDto
	) {
		return this.reviews.create(request.user.userId, bookingId, dto);
	}

	@Patch("porter-reviews/:reviewId")
	@ApiResponse({ status: 200, type: PorterReviewResponseDto })
	@ApiOperation({ summary: "Edit an owned review before the original completion-based deadline" })
	update(
		@Req() request: AuthenticatedRequest,
		@Param("reviewId", ID_PIPE) reviewId: string,
		@Body() dto: UpdatePorterReviewDto
	) {
		return this.reviews.update(request.user.userId, reviewId, dto);
	}
}
