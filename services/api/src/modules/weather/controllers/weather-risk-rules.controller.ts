import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
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
// biome-ignore lint/style/useImportType: decorated parameter needs runtime metadata
import { CreateWeatherRiskRuleDto } from "../dto/create-weather-risk-rule.dto";
import { WeatherRiskRuleResponseDto } from "../dto/weather-risk-rule-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRulesService } from "../services/weather-risk-rules.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("weather-rules")
@ApiBearerAuth()
@Controller("weather/rules")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeatherRiskRulesController {
	constructor(private readonly weatherRiskRulesService: WeatherRiskRulesService) {}

	@Get()
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "List all weather risk rule versions" })
	@ApiResponse({ status: 200, type: [WeatherRiskRuleResponseDto] })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	findAll(): Promise<WeatherRiskRuleResponseDto[]> {
		return this.weatherRiskRulesService.findAll();
	}

	@Get("active")
	@Roles(UserRole.ADMIN, UserRole.HOST)
	@ApiOperation({ summary: "Get the currently active weather risk rule set" })
	@ApiResponse({ status: 200, type: WeatherRiskRuleResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 404, description: "No active weather risk rule found" })
	async findActive(): Promise<WeatherRiskRuleResponseDto | null> {
		return this.weatherRiskRulesService.findActive();
	}

	@Get(":id")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Get a specific weather risk rule version by ID" })
	@ApiResponse({ status: 200, type: WeatherRiskRuleResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 404, description: "Rule version not found" })
	findById(@Param("id", ParseUUIDPipe) id: string): Promise<WeatherRiskRuleResponseDto> {
		return this.weatherRiskRulesService.findById(id);
	}

	@Post()
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Configure and persist a new weather risk rule version" })
	@ApiResponse({ status: 201, type: WeatherRiskRuleResponseDto })
	@ApiResponse({ status: 400, description: "Invalid thresholds or weight sum != 1.0" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	createRule(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreateWeatherRiskRuleDto
	): Promise<WeatherRiskRuleResponseDto> {
		return this.weatherRiskRulesService.createRule(req.user, dto);
	}

	@Patch(":id/activate")
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Set a specific rule version as active (deactivating all others)" })
	@ApiResponse({ status: 200, type: WeatherRiskRuleResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 404, description: "Rule version not found" })
	activateRule(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<WeatherRiskRuleResponseDto> {
		return this.weatherRiskRulesService.activateRule(req.user, id);
	}
}
