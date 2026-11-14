import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for validation
import { ReplaceTripPreferencesDto, TripPreferencesResponseDto } from "./dto/trip-preferences.dto";
import { TripRecommendationExplanationDto } from "./dto/trip-recommendation-explanation.dto";
import { TripRecommendationsResponseDto } from "./dto/trip-recommendations-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripRecommendationsService } from "./trip-recommendations.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/** CTMS-106. Camper-only; the JWT strategy already rejects inactive accounts. */
@ApiTags("trip-recommendations")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
export class TripRecommendationsController {
	constructor(private readonly service: TripRecommendationsService) {}

	@Get("profiles/me/trip-preferences")
	@ApiOperation({ summary: "Get the Camper's trip preferences" })
	@ApiResponse({ status: 200, type: TripPreferencesResponseDto })
	getPreferences(@Req() request: AuthenticatedRequest): Promise<TripPreferencesResponseDto> {
		return this.service.getPreferences(request.user.userId);
	}

	@Put("profiles/me/trip-preferences")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Replace the Camper's trip preferences (empty values clear them)" })
	@ApiResponse({ status: 200, type: TripPreferencesResponseDto })
	@ApiResponse({ status: 422, description: "Invalid preferences" })
	replacePreferences(
		@Req() request: AuthenticatedRequest,
		@Body() dto: ReplaceTripPreferencesDto
	): Promise<TripPreferencesResponseDto> {
		return this.service.replacePreferences(request.user.userId, dto);
	}

	@Get("trip-recommendations")
	@ApiOperation({ summary: "Up to 6 bookable Trips ranked for the Camper" })
	@ApiResponse({ status: 200, type: TripRecommendationsResponseDto })
	getRecommendations(
		@Req() request: AuthenticatedRequest
	): Promise<TripRecommendationsResponseDto> {
		return this.service.getRecommendations(request.user.userId);
	}

	@Get("trip-recommendations/trips/:tripId/explanation")
	@ApiOperation({
		summary: "Why a Trip from the Camper's latest suggestions was suggested, in Vietnamese",
	})
	@ApiResponse({ status: 200, type: TripRecommendationExplanationDto })
	@ApiResponse({ status: 404, description: "The Trip is not in the Camper's latest suggestions" })
	getExplanation(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", new ParseUUIDPipe()) tripId: string
	): Promise<TripRecommendationExplanationDto> {
		return this.service.getExplanation(request.user.userId, tripId);
	}
}
