import {
	Controller,
	Get,
	HttpStatus,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import {
	TripWeatherChangeNoticeDto,
	TripWeatherChangeNoticeListDto,
	toTripWeatherChangeNoticeDto,
} from "../dto/trip-weather-change-notice.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherChangeNoticesRepository } from "../repositories/trip-weather-change-notices.repository";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const NOTICE_LIST_LIMIT = 50;

/** CTMS-93 monitoring: the signed-in user's notices about Trip forecast level changes. */
@ApiTags("weather")
@ApiBearerAuth()
@Controller("me/weather-notices")
@UseGuards(JwtAuthGuard)
export class WeatherChangeNoticesController {
	constructor(private readonly notices: TripWeatherChangeNoticesRepository) {}

	@Get()
	@ApiOperation({ summary: "My notices about Trip forecast risk-level changes, newest first" })
	@ApiResponse({ status: 200, type: TripWeatherChangeNoticeListDto })
	async list(@Req() req: AuthenticatedRequest): Promise<TripWeatherChangeNoticeListDto> {
		const { items, unreadCount } = await this.notices.listForRecipient(
			req.user.userId,
			NOTICE_LIST_LIMIT
		);
		return { items: items.map(toTripWeatherChangeNoticeDto), unreadCount };
	}

	@Patch(":id/read")
	@ApiOperation({ summary: "Mark one of my weather notices as read (idempotent)" })
	@ApiResponse({ status: 200, type: TripWeatherChangeNoticeDto })
	@ApiResponse({ status: 404, description: "Notice absent or not mine" })
	async markRead(
		@Req() req: AuthenticatedRequest,
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<TripWeatherChangeNoticeDto> {
		const notice = await this.notices.markRead(req.user.userId, id);
		if (!notice) throw new NotFoundException("Notice not found");
		return toTripWeatherChangeNoticeDto(notice);
	}
}
