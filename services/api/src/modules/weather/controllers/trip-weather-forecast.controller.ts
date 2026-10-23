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
import { TripWeatherForecastResponseDto } from "../dto/trip-weather-forecast-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherForecastService } from "../services/trip-weather-forecast.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const TRIP_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

/** Weather forecast over a Trip's own schedule (owning Host or Admin). */
@ApiTags("weather")
@ApiBearerAuth()
@Controller("trips/:tripId/weather-forecast")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class TripWeatherForecastController {
	constructor(private readonly forecastService: TripWeatherForecastService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Forecast the weather over the Trip schedule and score its worst hours",
	})
	@ApiResponse({ status: 200, type: TripWeatherForecastResponseDto })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip status does not allow a forecast or Trip ended" })
	@ApiResponse({ status: 422, description: "Trip has no Route or schedule" })
	@ApiResponse({ status: 503, description: "Weather provider unavailable after retries" })
	forecast(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<TripWeatherForecastResponseDto> {
		return this.forecastService.forecastForTrip(req.user, tripId);
	}

	@Get("latest")
	@ApiOperation({ summary: "Get the most recent forecast stored for the Trip" })
	@ApiResponse({ status: 200, type: TripWeatherForecastResponseDto })
	getLatest(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<TripWeatherForecastResponseDto | null> {
		return this.forecastService.getLatest(req.user, tripId);
	}

	@Get("submitted")
	@ApiOperation({ summary: "Get the forecast attached when the Trip was submitted for approval" })
	@ApiResponse({ status: 200, type: TripWeatherForecastResponseDto })
	getSubmitted(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<TripWeatherForecastResponseDto | null> {
		return this.forecastService.getSubmitted(req.user, tripId);
	}

	@Post("advice")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Generate LLM advice for the latest Trip forecast" })
	@ApiResponse({ status: 200, type: TripWeatherForecastResponseDto })
	@ApiResponse({ status: 409, description: "No available forecast to explain" })
	@ApiResponse({ status: 503, description: "Advice service unavailable" })
	generateAdvice(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", TRIP_ID_PIPE) tripId: string
	): Promise<TripWeatherForecastResponseDto> {
		return this.forecastService.generateAdvice(req.user, tripId);
	}
}
