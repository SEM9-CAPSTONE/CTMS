import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe requires runtime class metadata
import { GetHostAnalyticsQueryDto } from "./dto/get-host-analytics-query.dto";
import type { HostAnalyticsResponseDto } from "./dto/host-analytics-response.dto";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsService } from "./host-analytics.service";

@Controller("host/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class HostAnalyticsController {
	constructor(private readonly hostAnalyticsService: HostAnalyticsService) {}

	@Get()
	@Header("Cache-Control", "no-store")
	async getHostAnalytics(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: GetHostAnalyticsQueryDto
	): Promise<HostAnalyticsResponseDto> {
		return this.hostAnalyticsService.getHostAnalytics(user, query);
	}
}
