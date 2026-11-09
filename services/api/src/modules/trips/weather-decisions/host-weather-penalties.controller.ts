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
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HostWeatherPenaltiesService } from "./host-weather-penalties.service";
// biome-ignore lint/style/useImportType: body/query DTO classes carry the class-validator metadata used at runtime
import {
	AdminWeatherPenaltyQueryDto,
	HostWeatherPenaltyDto,
	HostWeatherPenaltyListDto,
	RequestWeatherPenaltyWaiverDto,
	ReviewWeatherPenaltyWaiverDto,
} from "./host-weather-penalty.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

/** Penalty for a Host who did not answer a Red forecast (policy §6), with the waiver flow. */
@ApiTags("host-weather-penalties")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class HostWeatherPenaltiesController {
	constructor(private readonly service: HostWeatherPenaltiesService) {}

	@Get("me/weather-penalties")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "My weather penalties, the debt left and any hosting block" })
	@ApiResponse({ status: 200, type: HostWeatherPenaltyListDto })
	listMine(@Req() req: AuthenticatedRequest): Promise<HostWeatherPenaltyListDto> {
		return this.service.listForHost(req.user.userId);
	}

	@Post("host/weather-penalties/:id/waiver-request")
	@Roles(UserRole.HOST)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Ask for a force-majeure waiver within 72 h after T-24h" })
	@ApiResponse({ status: 200, type: HostWeatherPenaltyDto })
	@ApiResponse({ status: 404, description: "Penalty not found or not the caller's" })
	@ApiResponse({ status: 409, description: "Already requested or window closed" })
	@ApiResponse({ status: 422, description: "Missing reason or evidence" })
	requestWaiver(
		@Req() req: AuthenticatedRequest,
		@Param("id", UUID_PIPE) id: string,
		@Body() dto: RequestWeatherPenaltyWaiverDto
	): Promise<HostWeatherPenaltyDto> {
		return this.service.requestWaiver(req.user.userId, id, dto);
	}

	@Get("admin/weather-penalties")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Weather penalties, newest first; filter waiver_pending for reviews" })
	@ApiResponse({ status: 200, type: [HostWeatherPenaltyDto] })
	listForAdmin(@Query() query: AdminWeatherPenaltyQueryDto): Promise<HostWeatherPenaltyDto[]> {
		return this.service.listForAdmin(query.status);
	}

	@Get("admin/weather-penalties/:id")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "One weather penalty with its waiver request" })
	@ApiResponse({ status: 200, type: HostWeatherPenaltyDto })
	@ApiResponse({ status: 404, description: "Penalty not found" })
	getForAdmin(@Param("id", UUID_PIPE) id: string): Promise<HostWeatherPenaltyDto> {
		return this.service.getForAdmin(id);
	}

	@Post("admin/weather-penalties/:id/waiver-review")
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Approve (waive and refund) or reject a waiver request" })
	@ApiResponse({ status: 200, type: HostWeatherPenaltyDto })
	@ApiResponse({ status: 404, description: "Penalty not found" })
	@ApiResponse({ status: 409, description: "No request yet or already reviewed" })
	reviewWaiver(
		@Req() req: AuthenticatedRequest,
		@Param("id", UUID_PIPE) id: string,
		@Body() dto: ReviewWeatherPenaltyWaiverDto
	): Promise<HostWeatherPenaltyDto> {
		return this.service.reviewWaiver(req.user.userId, id, dto);
	}
}
