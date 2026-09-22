import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { ContentReportsService } from "./content-reports.service";
import { ContentReportResponseDto } from "./dto/content-report-response.dto";
// biome-ignore lint/style/useImportType: Body validation needs runtime DTO metadata
import { TransitionContentReportDto } from "./dto/transition-content-report.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}
const REPORT_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("content-reports")
@ApiBearerAuth()
@Controller("content-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin access required" })
@ApiResponse({ status: 404, description: "Content report not found" })
@ApiResponse({ status: 422, description: "Invalid input" })
export class ContentReportsController {
	constructor(private readonly reports: ContentReportsService) {}

	@Get(":reportId")
	@ApiOperation({ summary: "Read authoritative content report details" })
	@ApiResponse({ status: 200, type: ContentReportResponseDto })
	getReport(
		@Req() request: AuthenticatedRequest,
		@Param("reportId", REPORT_ID_PIPE) reportId: string
	): Promise<ContentReportResponseDto> {
		return this.reports.getReport(request.user.userId, reportId);
	}

	@Patch(":reportId/status")
	@ApiOperation({ summary: "Transition a pending content report without changing its target" })
	@ApiResponse({ status: 200, type: ContentReportResponseDto })
	@ApiResponse({ status: 409, description: "Stale or unsupported status transition" })
	transition(
		@Req() request: AuthenticatedRequest,
		@Param("reportId", REPORT_ID_PIPE) reportId: string,
		@Body() dto: TransitionContentReportDto
	): Promise<ContentReportResponseDto> {
		return this.reports.transition(request.user.userId, reportId, dto);
	}
}
