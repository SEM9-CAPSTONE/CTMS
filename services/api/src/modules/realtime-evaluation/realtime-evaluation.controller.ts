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
	RealtimeEvaluationReportResponseDto,
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the body
	RunRealtimeEvaluationDto,
} from "./dto/realtime-evaluation.dto";
import { REALTIME_EVALUATION_HISTORY_LIMIT } from "./realtime-evaluation.constants";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { RealtimeEvaluationService } from "./realtime-evaluation.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const REPORT_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("realtime-evaluation")
@ApiBearerAuth()
@Controller("evaluations/realtime")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class RealtimeEvaluationController {
	constructor(private readonly evaluationService: RealtimeEvaluationService) {}

	@Post("run")
	@ApiOperation({
		summary: "Evaluate real-time communication performance (CTMS-100)",
		description:
			"Connects temporary evaluation clients over loopback WebSocket, measures SOS delivery P95, normal event P95/P99 and missed-event recovery after reconnect, checks room restore and duplicate handling, applies the BR-281 release gates and stores the report with payload-free timing samples (BR-265, BR-282). Temporary accounts and their events are removed afterwards.",
	})
	@ApiResponse({ status: 201, type: RealtimeEvaluationReportResponseDto })
	@ApiResponse({ status: 409, description: "An evaluation is already running" })
	@ApiResponse({ status: 503, description: "The evaluation clients could not connect" })
	async runEvaluation(
		@Req() request: AuthenticatedRequest,
		@Body() dto: RunRealtimeEvaluationDto
	): Promise<RealtimeEvaluationReportResponseDto> {
		return this.evaluationService.runEvaluation(request.user.userId, dto);
	}

	@Get("latest")
	@ApiOperation({ summary: "Get the latest real-time evaluation report" })
	@ApiResponse({ status: 200, type: RealtimeEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "No report yet" })
	async getLatest(): Promise<RealtimeEvaluationReportResponseDto> {
		return this.evaluationService.getLatestReport();
	}

	@Get("reports")
	@ApiOperation({ summary: "List real-time evaluation reports, newest first" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiResponse({ status: 200, type: [RealtimeEvaluationReportResponseDto] })
	async getHistory(@Query("limit") limit?: string): Promise<RealtimeEvaluationReportResponseDto[]> {
		const parsed = limit ? Number.parseInt(limit, 10) : REALTIME_EVALUATION_HISTORY_LIMIT;
		return this.evaluationService.getHistory(
			Number.isNaN(parsed) ? REALTIME_EVALUATION_HISTORY_LIMIT : parsed
		);
	}

	@Get("reports/:id")
	@ApiOperation({ summary: "Get one real-time evaluation report" })
	@ApiResponse({ status: 200, type: RealtimeEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "Report not found" })
	async getReportById(
		@Param("id", REPORT_ID_PIPE) id: string
	): Promise<RealtimeEvaluationReportResponseDto> {
		return this.evaluationService.getReportById(id);
	}
}
