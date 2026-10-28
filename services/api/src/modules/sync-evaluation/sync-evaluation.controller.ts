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
	type RunSyncEvaluationDto,
	SyncEvaluationReportResponseDto,
} from "./dto/sync-evaluation.dto";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { SyncEvaluationService } from "./sync-evaluation.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const REPORT_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("sync-evaluation")
@ApiBearerAuth()
@Controller("evaluations/sync")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class SyncEvaluationController {
	constructor(private readonly evaluationService: SyncEvaluationService) {}

	@Post("run")
	@ApiOperation({
		summary: "Execute offline-sync evaluation scenarios and generate evaluation report (CTMS-097)",
		description:
			"Runs the 6 approved evaluation scenarios across connectivity loss, restart, retry, duplicate batches, ordering, and partial failure. Evaluates Release Gates (100% valid accepted, 0 safety events lost, 0 duplicates) and stores reproducible evidence.",
	})
	@ApiResponse({ status: 201, type: SyncEvaluationReportResponseDto })
	async runEvaluation(
		@Req() request: AuthenticatedRequest,
		@Body() dto: RunSyncEvaluationDto
	): Promise<SyncEvaluationReportResponseDto> {
		return this.evaluationService.runEvaluation(request.user.userId, dto);
	}

	@Get("latest")
	@ApiOperation({ summary: "Get latest sync evaluation report" })
	@ApiResponse({ status: 200, type: SyncEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "No report found" })
	async getLatest(): Promise<SyncEvaluationReportResponseDto> {
		return this.evaluationService.getLatestReport();
	}

	@Get("reports")
	@ApiOperation({ summary: "List sync evaluation report history" })
	@ApiQuery({ name: "limit", required: false, type: Number })
	@ApiResponse({ status: 200, type: [SyncEvaluationReportResponseDto] })
	async getHistory(@Query("limit") limit?: string): Promise<SyncEvaluationReportResponseDto[]> {
		const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
		return this.evaluationService.getHistory(Number.isNaN(parsedLimit) ? 20 : parsedLimit);
	}

	@Get("reports/:id")
	@ApiOperation({ summary: "Get a specific sync evaluation report by ID" })
	@ApiResponse({ status: 200, type: SyncEvaluationReportResponseDto })
	@ApiResponse({ status: 404, description: "Report not found" })
	async getReportById(
		@Param("id", REPORT_ID_PIPE) id: string
	): Promise<SyncEvaluationReportResponseDto> {
		return this.evaluationService.getReportById(id);
	}
}
