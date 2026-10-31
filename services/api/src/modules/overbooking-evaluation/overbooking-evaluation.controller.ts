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
	OverbookingEvaluationReportResponseDto,
	type RunOverbookingEvaluationDto,
} from "./dto/overbooking-evaluation.dto";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { OverbookingEvaluationService } from "./overbooking-evaluation.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const REPORT_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("overbooking-evaluation")
@ApiBearerAuth()
@Controller("evaluations/overbooking")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class OverbookingEvaluationController {
	constructor(private readonly evaluationService: OverbookingEvaluationService) {}

	@Post("run")
	@ApiOperation({
		summary:
			"Execute overbooking concurrency evaluation scenarios and generate evaluation report (CTMS-095)",
		description:
			"Runs concurrent booking scenarios across exact capacity, oversubscription, burst contention, multi-seat boundaries, and idempotent replays. Evaluates Release Gate ZERO_OVERBOOKING (seats_taken <= capacity_max in 100% of cases) and reports contention latency (BR-276, BR-282).",
	})
	@ApiResponse({ status: 201, type: OverbookingEvaluationReportResponseDto })
	async runEvaluation(
		@Req() request: AuthenticatedRequest,
		@Body() dto: RunOverbookingEvaluationDto
	): Promise<OverbookingEvaluationReportResponseDto> {
		return this.evaluationService.runEvaluation(request.user.userId, dto);
	}

	@Get("latest")
	@ApiOperation({ summary: "Get latest overbooking evaluation report" })
	@ApiResponse({ status: 200, type: OverbookingEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "No report found" })
	async getLatest(): Promise<OverbookingEvaluationReportResponseDto> {
		return this.evaluationService.getLatestReport();
	}

	@Get("reports")
	@ApiOperation({ summary: "List overbooking evaluation report history" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiResponse({ status: 200, type: [OverbookingEvaluationReportResponseDto] })
	async getHistory(
		@Query("limit") limit?: string
	): Promise<OverbookingEvaluationReportResponseDto[]> {
		const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
		return this.evaluationService.getHistory(Number.isNaN(parsedLimit) ? 20 : parsedLimit);
	}

	@Get("reports/:id")
	@ApiOperation({ summary: "Get a specific overbooking evaluation report by ID" })
	@ApiResponse({ status: 200, type: OverbookingEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "Report not found" })
	async getReportById(
		@Param("id", REPORT_ID_PIPE) id: string
	): Promise<OverbookingEvaluationReportResponseDto> {
		return this.evaluationService.getReportById(id);
	}
}
