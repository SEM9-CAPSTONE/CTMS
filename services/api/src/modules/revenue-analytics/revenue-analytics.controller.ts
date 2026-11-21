import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO metadata required for Swagger & validation
import { GetRevenueAnalyticsQueryDto } from "./dto/get-revenue-analytics-query.dto";
import { RevenueAnalyticsResponseDto } from "./dto/revenue-analytics-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { RevenueAnalyticsService } from "./revenue-analytics.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports/revenue")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RevenueAnalyticsController {
	constructor(private readonly service: RevenueAnalyticsService) {}

	@Get()
	@Roles(UserRole.ADMIN, UserRole.HOST)
	@ApiOperation({
		summary: "View Host Revenue Analytics by Time and Area (CTMS-110, BR-318..BR-329)",
		description:
			"Ledger-backed gross revenue, refunds, platform fee, net revenue, payouts and held funds within the caller's scope, filtered by time window and Trip area snapshot.",
	})
	@ApiResponse({ status: 200, type: RevenueAnalyticsResponseDto })
	@ApiResponse({ status: 400, description: "INVALID_DATE_RANGE" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Caller is neither Host nor Admin" })
	async getRevenueAnalytics(
		@Req() req: AuthenticatedRequest,
		@Query() query: GetRevenueAnalyticsQueryDto
	): Promise<RevenueAnalyticsResponseDto> {
		return this.service.getRevenueAnalytics(req.user, query);
	}
}
