import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO metadata required for Swagger & validation
import { GetPerformanceReportQueryDto } from "./dto/get-performance-report-query.dto";
import { PerformanceReportResponseDto } from "./dto/performance-report-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PerformanceReportsService } from "./performance-reports.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports/performance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceReportsController {
	constructor(private readonly service: PerformanceReportsService) {}

	@Get()
	@Roles(UserRole.ADMIN, UserRole.HOST)
	@ApiOperation({
		summary: "View Booking and Trip Performance Reports (CTMS-101, BR-283)",
		description:
			"Retrieves operational metrics (booking count, trip fill rate, cancellation rate, trip count, estimated and actual revenue) within the viewer's authorization scope.",
	})
	@ApiResponse({
		status: 200,
		type: PerformanceReportResponseDto,
		description: "Performance report computed successfully",
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Forbidden - caller role lacks report permissions" })
	@ApiResponse({ status: 400, description: "Invalid date range parameters" })
	async getReport(
		@Req() req: AuthenticatedRequest,
		@Query() query: GetPerformanceReportQueryDto
	): Promise<PerformanceReportResponseDto> {
		return this.service.getPerformanceReport(req.user, query);
	}
}
