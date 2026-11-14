import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import {
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the body
	RunWeatherRiskEvaluationDto,
	WeatherManualAssessmentDatasetSummaryDto,
	WeatherRiskEvaluationReportResponseDto,
} from "./dto/weather-risk-evaluation.dto";
import { WEATHER_RISK_EVALUATION_HISTORY_LIMIT } from "./weather-risk-evaluation.constants";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { WeatherRiskEvaluationService } from "./weather-risk-evaluation.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const REPORT_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("weather-risk-evaluation")
@ApiBearerAuth()
@Controller("evaluations/weather-risk")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class WeatherRiskEvaluationController {
	constructor(private readonly evaluationService: WeatherRiskEvaluationService) {}

	@Post("run")
	@ApiOperation({
		summary: "Compare Weather Risk results with a manual-assessment set (CTMS-099)",
		description:
			"Scores every case of a versioned manual-assessment set with a Weather Risk rule version, measures overall agreement, missed Red rate and false Red warning rate, breaks results out by Green/Yellow/Red and boundary cases, applies the V3 release gates and stores the report (BR-280, BR-282).",
	})
	@ApiResponse({ status: 201, type: WeatherRiskEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "Dataset or rule version not found" })
	@ApiResponse({ status: 409, description: "No active Weather Risk rule" })
	async runEvaluation(
		@Req() request: AuthenticatedRequest,
		@Body() dto: RunWeatherRiskEvaluationDto
	): Promise<WeatherRiskEvaluationReportResponseDto> {
		return this.evaluationService.runEvaluation(request.user.userId, dto);
	}

	@Get("datasets")
	@ApiOperation({ summary: "List the versioned manual-assessment sets" })
	@ApiResponse({ status: 200, type: [WeatherManualAssessmentDatasetSummaryDto] })
	listDatasets(): WeatherManualAssessmentDatasetSummaryDto[] {
		return this.evaluationService.listDatasets();
	}

	@Get("latest")
	@ApiOperation({ summary: "Get the latest Weather Risk evaluation report" })
	@ApiResponse({ status: 200, type: WeatherRiskEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "No report yet" })
	async getLatest(): Promise<WeatherRiskEvaluationReportResponseDto> {
		return this.evaluationService.getLatestReport();
	}

	@Get("reports")
	@ApiOperation({ summary: "List Weather Risk evaluation reports, newest first" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiResponse({ status: 200, type: [WeatherRiskEvaluationReportResponseDto] })
	async getHistory(
		@Query("limit") limit?: string
	): Promise<WeatherRiskEvaluationReportResponseDto[]> {
		const parsed = limit ? Number.parseInt(limit, 10) : WEATHER_RISK_EVALUATION_HISTORY_LIMIT;
		return this.evaluationService.getHistory(
			Number.isNaN(parsed) ? WEATHER_RISK_EVALUATION_HISTORY_LIMIT : parsed
		);
	}

	@Get("reports/:id")
	@ApiOperation({ summary: "Get one Weather Risk evaluation report" })
	@ApiResponse({ status: 200, type: WeatherRiskEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "Report not found" })
	async getReportById(
		@Param("id", REPORT_ID_PIPE) id: string
	): Promise<WeatherRiskEvaluationReportResponseDto> {
		return this.evaluationService.getReportById(id);
	}
}
