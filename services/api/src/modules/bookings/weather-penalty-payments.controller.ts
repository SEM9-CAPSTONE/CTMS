import {
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HostWeatherPenaltiesService } from "../trips/weather-decisions/host-weather-penalties.service";
import { HostWeatherPenaltyListDto } from "../trips/weather-decisions/host-weather-penalty.dto";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherPenaltyPaymentsService } from "./weather-penalty-payments.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

export class WeatherPenaltyCheckoutDto {
	@ApiProperty({ description: "PayOS payment page the Host is redirected to" })
	checkoutUrl!: string;

	@ApiProperty({ example: "430000.00", description: "Exactly what is still owed" })
	amount!: string;

	@ApiProperty({ example: 12345671234 })
	orderCode!: number;
}

/** The Host pays a weather penalty through PayOS (policy §6); recorded without an Admin. */
@ApiTags("host-weather-penalties")
@ApiBearerAuth()
@Controller("host/weather-penalties")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeatherPenaltyPaymentsController {
	constructor(
		private readonly payments: WeatherPenaltyPaymentsService,
		private readonly penalties: HostWeatherPenaltiesService
	) {}

	@Post(":id/payos-payment")
	@Roles(UserRole.HOST)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Open the PayOS payment link for what is still owed on the penalty" })
	@ApiResponse({ status: 200, type: WeatherPenaltyCheckoutDto })
	@ApiResponse({ status: 404, description: "Penalty not found or not the caller's" })
	@ApiResponse({ status: 409, description: "Nothing left to pay (paid, deducted or waived)" })
	@ApiResponse({ status: 503, description: "PayOS is not configured" })
	createCheckout(
		@Req() req: AuthenticatedRequest,
		@Param("id", UUID_PIPE) id: string
	): Promise<WeatherPenaltyCheckoutDto> {
		return this.payments.createCheckout(req.user.userId, id);
	}

	@Post("payos-sync")
	@Roles(UserRole.HOST)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Record PayOS payments of my penalties, then list them (works without the webhook)",
	})
	@ApiResponse({ status: 200, type: HostWeatherPenaltyListDto })
	async syncAndList(@Req() req: AuthenticatedRequest): Promise<HostWeatherPenaltyListDto> {
		await this.payments.syncPendingForHost(req.user.userId);
		return this.penalties.listForHost(req.user.userId);
	}
}
