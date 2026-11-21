import {
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
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import {
	TripWeatherAiAcknowledgeResponseDto,
	TripWeatherAiMismatchDto,
} from "../dto/trip-weather-ai-review.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherAiReviewService } from "../services/trip-weather-ai-review.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

/** Hybrid weather risk: Trips where the thresholds and the AI disagree (Admin only). */
@ApiTags("weather")
@ApiBearerAuth()
@Controller("admin/weather/ai-mismatches")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class WeatherAiReviewController {
	constructor(private readonly aiReviewService: TripWeatherAiReviewService) {}

	@Get()
	@ApiOperation({
		summary: "Upcoming Trips whose threshold level and AI opinion disagree, widest gap first",
	})
	@ApiResponse({ status: 200, type: [TripWeatherAiMismatchDto] })
	list(): Promise<TripWeatherAiMismatchDto[]> {
		return this.aiReviewService.listMismatches();
	}

	@Post(":forecastId/acknowledge")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Mark a disagreement as seen; idempotent" })
	@ApiResponse({ status: 200, type: TripWeatherAiAcknowledgeResponseDto })
	@ApiResponse({ status: 404, description: "Forecast not found" })
	@ApiResponse({ status: 409, description: "The forecast has no disagreement to review" })
	acknowledge(
		@Req() req: AuthenticatedRequest,
		@Param("forecastId", ID_PIPE) forecastId: string
	): Promise<TripWeatherAiAcknowledgeResponseDto> {
		return this.aiReviewService.acknowledge(req.user, forecastId);
	}
}
