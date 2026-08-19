import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { AuditLogsService } from "./audit-logs.service";
import { Roles } from "./decorators/roles.decorator";
import { PaginatedAuditLogsResponseDto } from "./dto/audit-log-response.dto";
// biome-ignore lint/style/useImportType: used as a @Query() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import type { AuthenticatedUser } from "./jwt.strategy";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("audit-logs")
@ApiBearerAuth()
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogsController {
	constructor(private readonly auditLogsService: AuditLogsService) {}

	@Get()
	@ApiOperation({ summary: "List and filter audit logs" })
	@ApiResponse({ status: 200, type: PaginatedAuditLogsResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 422, description: "Invalid query" })
	listAuditLogs(
		@Req() request: AuthenticatedRequest,
		@Query() query: ListAuditLogsQueryDto
	): Promise<PaginatedAuditLogsResponseDto> {
		return this.auditLogsService.listAuditLogs(request.user.userId, query);
	}
}
