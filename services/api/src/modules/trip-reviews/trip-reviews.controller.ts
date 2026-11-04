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
	TripReviewContextResponseDto,
	TripReviewResponseDto,
} from "./dto/trip-review-response.dto";
// biome-ignore lint/style/useImportType: runtime DTO validation
import { CreateTripReviewDto, UpdateTripReviewDto } from "./dto/trip-review.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { TripReviewsService } from "./trip-reviews.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}
const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("trip-reviews")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Camper role and own linked participation required" })
@ApiResponse({ status: 409, description: "Review window closed, duplicate or stale revision" })
@ApiResponse({ status: 422, description: "Invalid input" })
export class TripReviewsController {
	constructor(private readonly reviews: TripReviewsService) {}

	@Get("bookings/:bookingId/reviews/context")
	@ApiResponse({ status: 200, type: TripReviewContextResponseDto })
	@ApiOperation({ summary: "Read own review eligibility, deadline and current Trip/Host reviews" })
	context(@Req() request: AuthenticatedRequest, @Param("bookingId", ID_PIPE) bookingId: string) {
		return this.reviews.context(request.user.userId, bookingId);
	}

	@Post("bookings/:bookingId/reviews")
	@ApiResponse({ status: 201, type: TripReviewResponseDto })
	@ApiOperation({ summary: "Review the Trip or actual Host through completed participation" })
	create(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", ID_PIPE) bookingId: string,
		@Body() dto: CreateTripReviewDto
	) {
		return this.reviews.create(request.user.userId, bookingId, dto);
	}

	@Patch("trip-reviews/:reviewId")
	@ApiResponse({ status: 200, type: TripReviewResponseDto })
	@ApiOperation({
		summary: "Edit own review within the original review window, retaining revisions",
	})
	@ApiResponse({ status: 404, description: "Review not found" })
	update(
		@Req() request: AuthenticatedRequest,
		@Param("reviewId", ID_PIPE) reviewId: string,
		@Body() dto: UpdateTripReviewDto
	) {
		return this.reviews.update(request.user.userId, reviewId, dto);
	}
}
