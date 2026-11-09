import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
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
// biome-ignore lint/style/useImportType: body DTO classes carry the class-validator metadata used at runtime
import {
	AdminWeatherDecisionDto,
	HostWeatherDecisionDto,
	TripWeatherDecisionAlertDto,
	TripWeatherDecisionAlertListDto,
	TripWeatherDecisionDto,
	TripWeatherDecisionLogDto,
	WeatherInterventionDto,
	WeatherRescheduleResponseDto,
	WeatherRescheduleResponseResultDto,
	toTripWeatherDecisionAlertDto,
} from "./trip-weather-decision.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherDecisionService } from "./trip-weather-decision.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherDecisionsRepository } from "./trip-weather-decisions.repository";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
const ALERT_LIST_LIMIT = 50;

/** Weather decision near departure (docs/features/weather-trip-date-decision-policy.md §5). */
@ApiTags("trip-weather-decisions")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripWeatherDecisionsController {
	constructor(
		private readonly service: TripWeatherDecisionService,
		private readonly repository: TripWeatherDecisionsRepository
	) {}

	@Post("trips/:tripId/weather-decision")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Host keeps, reschedules or cancels a Red Trip in the last 3 days" })
	@ApiResponse({ status: 201, type: TripWeatherDecisionDto })
	@ApiResponse({ status: 403, description: "Not the owning Host" })
	@ApiResponse({
		status: 409,
		description: "Not published, outside 3 days, not Red, or Admin already decided",
	})
	@ApiResponse({ status: 422, description: "Missing reason, safety plan or new date" })
	decideAsHost(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Body() dto: HostWeatherDecisionDto
	): Promise<TripWeatherDecisionDto> {
		return this.service.decideAsHost(req.user.userId, tripId, dto);
	}

	@Get("trips/:tripId/weather-decisions")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Weather decision log of a Trip with its pause state" })
	@ApiResponse({ status: 200, type: TripWeatherDecisionLogDto })
	@ApiResponse({ status: 404, description: "Trip not found or not the caller's" })
	getLog(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string
	): Promise<TripWeatherDecisionLogDto> {
		return this.service.getDecisionLog(req.user, tripId);
	}

	@Post("admin/trips/:tripId/weather-decision")
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: "Admin keeps, reschedules, cancels, pauses or resumes a Trip in the last 3 days",
	})
	@ApiResponse({ status: 201, type: TripWeatherDecisionDto })
	@ApiResponse({
		status: 409,
		description: "Not published, outside 3 days, not Red, or pause state mismatch",
	})
	@ApiResponse({ status: 422, description: "Missing reason or new date" })
	decideAsAdmin(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Body() dto: AdminWeatherDecisionDto
	): Promise<TripWeatherDecisionDto> {
		return this.service.decideAsAdmin(req.user.userId, tripId, dto);
	}

	@Get("admin/weather-interventions")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Red Trips that need an Admin decision now, most urgent first" })
	@ApiResponse({ status: 200, type: [WeatherInterventionDto] })
	listInterventions(): Promise<WeatherInterventionDto[]> {
		return this.service.listInterventions();
	}

	@Get("me/weather-decision-alerts")
	@Roles(UserRole.CAMPER, UserRole.PORTER, UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "My weather decision reminders, newest first" })
	@ApiResponse({ status: 200, type: TripWeatherDecisionAlertListDto })
	async listAlerts(@Req() req: AuthenticatedRequest): Promise<TripWeatherDecisionAlertListDto> {
		const { items, unreadCount } = await this.repository.listAlerts(
			req.user.userId,
			ALERT_LIST_LIMIT
		);
		return { items: items.map(toTripWeatherDecisionAlertDto), unreadCount };
	}

	@Patch("me/weather-decision-alerts/:id/read")
	@Roles(UserRole.CAMPER, UserRole.PORTER, UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Mark one of my weather decision reminders as read" })
	@ApiResponse({ status: 200, type: TripWeatherDecisionAlertDto })
	@ApiResponse({ status: 404, description: "Reminder not found or not the caller's" })
	async markAlertRead(
		@Req() req: AuthenticatedRequest,
		@Param("id", UUID_PIPE) id: string
	): Promise<TripWeatherDecisionAlertDto> {
		const alert = await this.repository.markAlertRead(req.user.userId, id);
		if (!alert) throw new NotFoundException("Reminder not found");
		return toTripWeatherDecisionAlertDto(alert);
	}

	@Post("bookings/:bookingId/weather-reschedule-response")
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Camper keeps the booking on the new date or cancels it with a 100% refund",
	})
	@ApiResponse({ status: 200, type: WeatherRescheduleResponseResultDto })
	@ApiResponse({ status: 404, description: "Booking not found or not the caller's" })
	@ApiResponse({
		status: 409,
		description: "Not waiting for an answer or not a weather reschedule",
	})
	respond(
		@Req() req: AuthenticatedRequest,
		@Param("bookingId", UUID_PIPE) bookingId: string,
		@Body() dto: WeatherRescheduleResponseDto
	): Promise<WeatherRescheduleResponseResultDto> {
		return this.service.respondToWeatherReschedule(req.user.userId, bookingId, dto.accept);
	}
}
